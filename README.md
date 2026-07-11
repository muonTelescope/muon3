# Muon Telescope Engineering Archive

Umbrella repository for the historical `muonTelescope` projects, public research references,
and next-generation detector redesign work.

The 28 upstream projects are retained as Git submodules so their complete individual histories
and remotes remain intact. Design exports, simulations, KiCad artifacts, publications, review
findings, and current requirements are versioned directly by this repository.

Start with [the archive index](reference_documentation/README.md), then read:

1. [Next-generation requirements](reference_documentation/review_and_requirements/NEXT_GENERATION_REQUIREMENTS.md)
2. [PCB and system design review](reference_documentation/review_and_requirements/NEXT_GENERATION_PCB_REVIEW.md)
3. [Publication index](reference_documentation/publications/README.md)
4. [Historical decision record](reference_documentation/prior_design_exports/DECISIONS.md)

## Cloning

Clone with submodules:

```sh
git clone --recurse-submodules <repository-url>
```

For an existing clone:

```sh
git submodule update --init --recursive
```

