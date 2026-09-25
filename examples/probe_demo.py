"""
Synthetic training curves, no ML libraries needed: the quickest way to see the Run Monitor work.

	pip install -e packages/forge-probe
	python examples/probe_demo.py --steps 300 --delay 0.05
"""

import argparse
import math
import random
import time

import forge_probe


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument('--steps', type=int, default=300)
	parser.add_argument('--delay', type=float, default=0.05, help='seconds between steps')
	parser.add_argument('--name', default='probe-demo')
	parser.add_argument('--fail-at', type=int, default=-1, help='raise at this step (demo)')
	args = parser.parse_args()

	rng = random.Random(7)  # noqa: S311 - fake data, not crypto
	config = {'steps': args.steps, 'lr': 3e-4, 'model': {'layers': 4, 'width': 256}}
	with forge_probe.run(args.name, config=config, project='examples') as probe:
		for step in range(args.steps):
			if step == args.fail_at:
				raise RuntimeError(f'simulated failure at step {step}')
			progress = step / max(1, args.steps - 1)
			train_loss = 2.3 * math.exp(-4 * progress) + 0.05 + rng.gauss(0, 0.03)
			probe.log(step=step, **{'train/loss': train_loss, 'lr': 3e-4 * (1 - progress)})
			if step % 25 == 0 or step == args.steps - 1:
				probe.log(
					step=step,
					**{'val/loss': train_loss + 0.1, 'val/acc': 1 - math.exp(-5 * progress) * 0.9},
				)
			time.sleep(args.delay)


if __name__ == '__main__':
	main()
