import logging
import threading
from typing import Any

import pynvml
from pydantic import BaseModel

logger = logging.getLogger('forge_sidecar.gpu')


class GpuStats(BaseModel):
	index: int
	name: str
	utilization: float | None  # %
	memory_used: int | None  # bytes
	memory_total: int | None
	temperature: float | None  # °C
	power: float | None  # W
	power_limit: float | None  # W
	fan: float | None  # %


class GpuSnapshot(BaseModel):
	available: bool
	reason: str | None = None
	driver: str | None = None
	gpus: list[GpuStats] = []


def _read(fn: Any, *args: Any) -> Any:
	# Consumer cards don't support every query (fan on laptops, power on some models).
	try:
		return fn(*args)
	except pynvml.NVMLError:
		return None


class GpuMonitor:
	"""NVIDIA GPUs via NVML. Without a driver/GPU it reports unavailable instead of failing."""

	def __init__(self, nvml: Any = pynvml) -> None:
		self.nvml = nvml
		self._lock = threading.Lock()
		self._ready = False
		self._error: str | None = None

	def _init(self) -> bool:
		if self._ready:
			return True
		try:
			self.nvml.nvmlInit()
		except (pynvml.NVMLError, OSError) as error:
			# NVML_ERROR_LIBRARY_NOT_FOUND / DRIVER_NOT_LOADED: no NVIDIA GPU on this machine.
			self._error = str(error) or type(error).__name__
			return False
		self._ready = True
		return True

	def snapshot(self) -> GpuSnapshot:
		n = self.nvml
		with self._lock:
			if not self._init():
				return GpuSnapshot(
					available=False, reason=f'NVIDIA driver not available ({self._error})'
				)
			try:
				count = n.nvmlDeviceGetCount()
			except pynvml.NVMLError as error:
				logger.warning('NVML device count failed: %s', error)
				return GpuSnapshot(available=False, reason=str(error))
			gpus: list[GpuStats] = []
			for index in range(count):
				handle = n.nvmlDeviceGetHandleByIndex(index)
				util = _read(n.nvmlDeviceGetUtilizationRates, handle)
				memory = _read(n.nvmlDeviceGetMemoryInfo, handle)
				power = _read(n.nvmlDeviceGetPowerUsage, handle)  # mW
				limit = _read(n.nvmlDeviceGetEnforcedPowerLimit, handle)  # mW
				gpus.append(
					GpuStats(
						index=index,
						name=str(_read(n.nvmlDeviceGetName, handle) or f'GPU {index}'),
						utilization=float(util.gpu) if util is not None else None,
						memory_used=int(memory.used) if memory is not None else None,
						memory_total=int(memory.total) if memory is not None else None,
						temperature=_read(
							n.nvmlDeviceGetTemperature, handle, n.NVML_TEMPERATURE_GPU
						),
						power=power / 1000 if power is not None else None,
						power_limit=limit / 1000 if limit is not None else None,
						fan=_read(n.nvmlDeviceGetFanSpeed, handle),
					)
				)
			driver = _read(n.nvmlSystemGetDriverVersion)
			return GpuSnapshot(available=True, driver=str(driver) if driver else None, gpus=gpus)

	def close(self) -> None:
		with self._lock:
			if self._ready:
				_read(self.nvml.nvmlShutdown)
				self._ready = False
