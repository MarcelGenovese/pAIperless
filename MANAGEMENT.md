# pAIperless Management Script

This document describes the management CLI tool for pAIperless, which allows you to manage the system from outside the Docker container without requiring web access or authentication.

## Overview

The management script (`scripts/manage.sh`) provides a command-line interface for critical operations such as:
- Resetting Paperless credentials (important if you get locked out)
- Managing configuration values
- Viewing system information and logs
- Regenerating API keys

## Prerequisites

- Docker must be installed and running
- The `paiperless` container must be running
- Execute commands from the project root directory

## Usage

```bash
./scripts/manage.sh <command> [args]
```

## Available Commands

### Reset Paperless API Token

If you change the Paperless API token or get locked out, use this command to update it:

```bash
# Method 1: Pass token as argument (appears in bash history)
./scripts/manage.sh reset-paperless-token "your-new-token"

# Method 2: Pipe token via stdin (secure, doesn't appear in history)
echo "your-new-token" | ./scripts/manage.sh reset-paperless-token
```

**Security Note**: Method 2 is preferred as it prevents the token from appearing in your bash history.

### Reset Paperless URL

Change the Paperless-NGX URL:

```bash
./scripts/manage.sh reset-paperless-url "http://paperless:8000"
```

### Reset Setup Wizard

Reset the setup flag to re-run the setup wizard (preserves existing configuration):

```bash
./scripts/manage.sh reset-setup
```

After running this, navigate to `/setup` in your browser to run the wizard again. All your existing configuration values will be pre-filled.

### List All Configuration

View all configuration values:

```bash
# List with secrets hidden (default)
./scripts/manage.sh list-config

# List with secrets visible (use with caution)
./scripts/manage.sh list-config --show-secrets
```

### Get Specific Configuration Value

Retrieve a single configuration value:

```bash
# Get non-secret value
./scripts/manage.sh get-config PAPERLESS_URL

# Get secret value (hidden by default)
./scripts/manage.sh get-config PAPERLESS_TOKEN

# Show secret value
./scripts/manage.sh get-config PAPERLESS_TOKEN --show-secret
```

### Set Configuration Value

Set a configuration value:

```bash
./scripts/manage.sh set-config SOME_KEY "some value"
```

**Warning**: This bypasses validation. Use the web UI for normal configuration changes.

### Generate New Webhook API Key

Generate a new webhook API key for Paperless webhooks:

```bash
./scripts/manage.sh generate-webhook-key
```

After generating, update the key in your Paperless-NGX webhook configuration.

### Show System Information

Display system statistics:

```bash
./scripts/manage.sh system-info
```

Shows:
- Setup completion status
- Paperless URL
- Document counts (total, completed, errors, in progress)

### View Logs

View recent system logs:

```bash
# Show last 50 logs (default)
./scripts/manage.sh logs

# Show last 100 logs
./scripts/manage.sh logs 100
```

### Help

Show help message:

```bash
./scripts/manage.sh help
```

## Common Use Cases

### Scenario 1: Locked Out After Token Change

If you changed the Paperless API token in Paperless-NGX and can no longer login to pAIperless:

```bash
echo "new-token-from-paperless" | ./scripts/manage.sh reset-paperless-token
```

### Scenario 2: Changing Paperless Server

If you moved Paperless-NGX to a new server:

```bash
./scripts/manage.sh reset-paperless-url "http://new-server:8000"
echo "new-token" | ./scripts/manage.sh reset-paperless-token
```

### Scenario 3: Debugging Configuration Issues

Check what configuration is stored:

```bash
./scripts/manage.sh list-config
./scripts/manage.sh system-info
./scripts/manage.sh logs 100
```

### Scenario 4: Re-running Setup

If you want to change multiple settings through the wizard:

```bash
./scripts/manage.sh reset-setup
```

Then navigate to http://your-server:3002/setup in your browser.

## Security Considerations

### Secrets in Bash History

By default, bash stores all commands in `~/.bash_history`. To prevent secrets from being stored:

1. Use stdin piping for sensitive values:
   ```bash
   echo "secret" | ./scripts/manage.sh reset-paperless-token
   ```

2. Or temporarily disable history:
   ```bash
   set +o history
   ./scripts/manage.sh reset-paperless-token "secret"
   set -o history
   ```

### Audit Logging

All critical operations performed via the management script are logged to the database audit log. View them with:

```bash
./scripts/manage.sh logs
```

Audit entries include:
- Action performed
- Timestamp
- User (always "cli" for management script)
- Details of what was changed

### Showing Secrets

The `--show-secrets` and `--show-secret` flags display sensitive values in plain text. Use these flags only when necessary and ensure no one is looking over your shoulder.

## Troubleshooting

### Error: Container 'paiperless' is not running

The container must be running for the management script to work. Start it with:

```bash
docker compose up -d
```

### Error: CLI script not found in container

The container may need to be rebuilt to include the management script:

```bash
docker compose down
docker compose up --build -d
```

### Permission Denied

Make sure the script is executable:

```bash
chmod +x ./scripts/manage.sh
```

### Database Locked

If you get a "database is locked" error, the application may be performing intensive operations. Wait a moment and try again.

## Advanced Usage

### Direct Container Access

You can also run the CLI directly inside the container:

```bash
docker exec -it paiperless node /app/scripts/cli.js help
```

### Scripting and Automation

The management script can be used in automation scripts. It returns appropriate exit codes:
- `0`: Success
- `1`: Error

Example automation script:

```bash
#!/bin/bash
if echo "$NEW_TOKEN" | ./scripts/manage.sh reset-paperless-token; then
    echo "Token updated successfully"
else
    echo "Failed to update token"
    exit 1
fi
```

## Implementation Details

The management system consists of two components:

1. **Bash Wrapper** (`scripts/manage.sh`):
   - Checks if container is running
   - Passes commands to CLI inside container
   - Handles stdin piping for secrets

2. **Node.js CLI** (`scripts/cli.js`):
   - Runs inside the container
   - Direct Prisma database access
   - Implements all commands
   - Writes audit logs

## Support

If you encounter issues with the management script, check:
1. Container logs: `docker logs paiperless`
2. System logs: `./scripts/manage.sh logs 100`
3. GitHub Issues: https://github.com/yourusername/paiperless/issues
