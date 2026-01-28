#!/bin/bash

# Get git tag if available, otherwise use commit hash
if git describe --tags --exact-match 2>/dev/null; then
    # We're on a tagged commit
    git describe --tags --exact-match
elif git describe --tags 2>/dev/null; then
    # We have tags but not on exact match
    git describe --tags
else
    # No tags, use short commit hash
    git rev-parse --short HEAD
fi
