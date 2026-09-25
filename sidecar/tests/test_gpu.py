from types import SimpleNamespace
from typing import Any

import pynvml

from forge_sidecar.services.gpu import GpuMonitor


class FakeNvml:
	NVML_TEMPERATURE_GPU = 0

	def __init__(self, fail_init: bool = False) -> None:
		self.fail_init = fail_init
		self.inits = 0

	def nvmlInit(self) -> None:
		self.inits += 1
		if self.fail_init:
			raise pynvml.NVMLError(pynvml.NVML_ERROR_LIBRARY_NOT_FOUND)

	def nvmlDeviceGetCount(self) -> int:
		return 1

	def nvmlDeviceGetHandleByIndex(self, index: int) -> int:
		return index

	def nvmlDeviceGetName(self, handle: Any) -> str:
		return 'NVIDIA GeForce RTX 5070'

	def nvmlDeviceGetUtilizationRates(self, handle: Any) -> Any:
		return SimpleNamespace(gpu=44, memory=10)

	def nvmlDeviceGetMemoryInfo(self, handle: Any) -> Any:
		return SimpleNamespace(used=4 * 2**30, total=12 * 2**30)

	def nvmlDeviceGetTemperature(self, handle: Any, sensor: int) -> int:
		return 61

	def nvmlDeviceGetPowerUsage(self, handle: Any) -> int:
		return 132_513

	def nvmlDeviceGetEnforcedPowerLimit(self, handle: Any) -> int:
		return 250_000

	def nvmlDeviceGetFanSpeed(self, handle: Any) -> int:
		raise pynvml.NVMLError(pynvml.NVML_ERROR_NOT_SUPPORTED)

	def nvmlSystemGetDriverVersion(self) -> str:
		return '610.74'

	def nvmlShutdown(self) -> None:
		pass


def test_snapshot_reads_every_gpu_and_tolerates_unsupported_queries() -> None:
	nvml = FakeNvml()
	monitor = GpuMonitor(nvml)
	snap = monitor.snapshot()
	monitor.snapshot()
	assert nvml.inits == 1  # NVML is initialised once, not per poll
	assert snap.available and snap.driver == '610.74'
	[gpu] = snap.gpus
	assert gpu.name == 'NVIDIA GeForce RTX 5070'
	assert (gpu.utilization, gpu.temperature, gpu.power, gpu.power_limit) == (44, 61, 132.513, 250)
	assert gpu.memory_total == 12 * 2**30
	assert gpu.fan is None


def test_snapshot_without_nvidia_driver_is_unavailable_not_an_error() -> None:
	snap = GpuMonitor(FakeNvml(fail_init=True)).snapshot()
	assert not snap.available and snap.gpus == []
	assert snap.reason and 'NVIDIA driver not available' in snap.reason
