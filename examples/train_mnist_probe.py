"""
MNIST CNN in PyTorch, streaming metrics to Forge's Lab → Run Monitor via forge-probe.

Setup (in the environment you train in):
	pip install torch torchvision   # CUDA build: see https://pytorch.org/get-started/locally/
	pip install -e path/to/forge/packages/forge-probe

Run with Forge open:
	python examples/train_mnist_probe.py --epochs 3
"""

import argparse
import time
from pathlib import Path

import forge_probe
import torch
from torch import nn
from torch.nn import functional as F  # noqa: N812
from torch.utils.data import DataLoader
from torchvision import datasets, transforms


class Net(nn.Module):
	def __init__(self) -> None:
		super().__init__()
		self.conv1 = nn.Conv2d(1, 32, 3)
		self.conv2 = nn.Conv2d(32, 64, 3)
		self.drop = nn.Dropout(0.25)
		self.fc1 = nn.Linear(9216, 128)
		self.fc2 = nn.Linear(128, 10)

	def forward(self, x: torch.Tensor) -> torch.Tensor:
		x = F.relu(self.conv1(x))
		x = F.max_pool2d(F.relu(self.conv2(x)), 2)
		x = torch.flatten(self.drop(x), 1)
		return self.fc2(self.drop(F.relu(self.fc1(x))))


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> tuple[float, float]:
	model.eval()
	loss_sum, correct, seen = 0.0, 0, 0
	with torch.no_grad():
		for images, labels in loader:
			images, labels = images.to(device), labels.to(device)
			logits = model(images)
			loss_sum += F.cross_entropy(logits, labels, reduction='sum').item()
			correct += (logits.argmax(1) == labels).sum().item()
			seen += labels.numel()
	model.train()
	return loss_sum / seen, correct / seen


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument('--epochs', type=int, default=3)
	parser.add_argument('--batch-size', type=int, default=64)
	parser.add_argument('--lr', type=float, default=1e-3)
	parser.add_argument('--data', type=Path, default=Path.home() / '.cache' / 'mnist')
	parser.add_argument('--log-every', type=int, default=20)
	args = parser.parse_args()

	device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
	tfm = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])
	train = datasets.MNIST(args.data, train=True, download=True, transform=tfm)
	test = datasets.MNIST(args.data, train=False, download=True, transform=tfm)
	train_loader = DataLoader(train, batch_size=args.batch_size, shuffle=True, num_workers=2)
	test_loader = DataLoader(test, batch_size=1000, num_workers=2)

	model = Net().to(device)
	optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)
	total_steps = args.epochs * len(train_loader)
	scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, args.lr, total_steps=total_steps)

	config = {
		**vars(args),
		'device': str(device),
		'gpu': torch.cuda.get_device_name(0) if device.type == 'cuda' else None,
		'params': sum(p.numel() for p in model.parameters()),
		'optimizer': 'AdamW',
		'scheduler': 'OneCycleLR',
	}
	# The context manager marks the run failed (with the error) if training crashes.
	with forge_probe.run('mnist-cnn', config=config, project='examples') as probe:
		step = 0
		for epoch in range(args.epochs):
			started = time.perf_counter()
			for images, labels in train_loader:
				images, labels = images.to(device), labels.to(device)
				logits = model(images)
				loss = F.cross_entropy(logits, labels)
				optimizer.zero_grad(set_to_none=True)
				loss.backward()
				optimizer.step()
				scheduler.step()
				if step % args.log_every == 0:
					acc = (logits.argmax(1) == labels).float().mean()
					# Tensors are fine: the probe converts 1-element tensors with float().
					probe.log(
						step=step,
						**{'train/loss': loss, 'train/acc': acc, 'lr': scheduler.get_last_lr()[0]},
					)
				step += 1
			val_loss, val_acc = evaluate(model, test_loader, device)
			probe.log(
				step=step,
				**{
					'val/loss': val_loss,
					'val/acc': val_acc,
					'epoch_seconds': time.perf_counter() - started,
				},
			)
			print(f'epoch {epoch + 1}: val_loss={val_loss:.4f} val_acc={val_acc:.4f}')


if __name__ == '__main__':
	main()
