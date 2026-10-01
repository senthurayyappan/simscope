"""Runs the command line: ``python -m simscope``."""

import sys

from simscope import cli

if __name__ == "__main__":
    sys.exit(cli.main())
