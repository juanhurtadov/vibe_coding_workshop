# Vibe Coding Workshop

## Prerequisites

- [Conda](https://docs.conda.io/en/latest/miniconda.html) installed on your machine
- [Node.js 20+](https://nodejs.org/) (installed via conda, see below)

## Setup

### 1. Create and activate the conda environment

```bash
conda env create --file environment.yml
conda activate example-environment
```

This installs:
- Python 3.12
- Node.js 20
- numpy, pandas

### 2. Install Node.js dependencies

```bash
npm install
```

## Updating dependencies

### Add a Python package

1. Add it to `environment.yml` under `dependencies`
2. Run:
```bash
conda env update --file environment.yml --prune
```

### Add a Node.js package

```bash
npm install <package-name> --save
```

This automatically updates `package.json`.
