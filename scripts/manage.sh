#!/bin/bash
# pAIperless Management Script
#
# This script provides a convenient wrapper for managing pAIperless from outside the container.
# It executes the CLI tool inside the running container.
#
# Usage: ./scripts/manage.sh <command> [args]

set -e

# Configuration
CONTAINER_NAME="paiperless"
CLI_SCRIPT="/app/scripts/cli.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if container is running
check_container() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${RED}❌ Error: Container '${CONTAINER_NAME}' is not running${NC}"
        echo "Start it with: docker compose up -d"
        exit 1
    fi
}

# Check if CLI script exists in container
check_cli_script() {
    if ! docker exec "$CONTAINER_NAME" test -f "$CLI_SCRIPT"; then
        echo -e "${RED}❌ Error: CLI script not found in container at ${CLI_SCRIPT}${NC}"
        echo "The container may need to be rebuilt."
        exit 1
    fi
}

# Show help if no arguments
if [ $# -eq 0 ] || [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    check_container
    docker exec -i "$CONTAINER_NAME" node "$CLI_SCRIPT" help
    exit 0
fi

# Check prerequisites
check_container
check_cli_script

# Special handling for commands that need stdin
if [ "$1" = "reset-paperless-token" ] && [ -z "$2" ]; then
    # If token is not provided as argument, pass stdin to container
    if [ -t 0 ]; then
        # stdin is a terminal, no piped input
        echo -e "${YELLOW}⚠️  No token provided. Please pipe the token or provide as argument.${NC}"
        echo "Examples:"
        echo "  echo 'your-token' | ./scripts/manage.sh reset-paperless-token"
        echo "  ./scripts/manage.sh reset-paperless-token 'your-token'"
        exit 1
    else
        # stdin is piped, pass it through
        docker exec -i "$CONTAINER_NAME" node "$CLI_SCRIPT" "$@"
    fi
else
    # For all other commands, run normally
    docker exec -i "$CONTAINER_NAME" node "$CLI_SCRIPT" "$@"
fi
