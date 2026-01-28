# FTP Server Configuration

## Overview

pAIperless includes an integrated FTP server that allows you to upload documents directly via FTP. The uploaded files are automatically processed through the document pipeline.

## Network Configuration

The FTP server requires special network configuration to work correctly with external clients due to FTP's passive mode requirements.

### Required Ports

The following ports must be exposed in your Docker setup:

- **Port 21**: FTP control connection (command channel)
- **Ports 1024-1048**: FTP passive mode data connections

These are already configured in the `docker-compose.yml` file.

### Passive Mode IP Address

FTP passive mode requires the server to tell clients which IP address to connect to for data transfers.

**pAIperless uses the smartest approach: It automatically uses the same IP address that the client connected to!**

When a client connects to the FTP server on port 21, the server knows exactly which of its IP addresses was used for the connection. This same IP address is then returned for passive mode data connections.

**This means zero configuration is needed!** Whether you connect via:
- Local network: `192.168.1.100`
- VPN: `10.0.0.50`
- Public IP: `203.0.113.45`

The server automatically responds with the correct IP address.

Only set `FTP_PASV_URL` manually if:
- You're behind NAT/port forwarding and need to specify the public IP
- You have complex networking requirements

## Configuration Steps

### Automatic Configuration (Recommended)

**No configuration needed at all!** The FTP server automatically detects the correct IP address from each client connection.

Simply:
1. Enable FTP server in the dashboard
2. Set username and password
3. Connect from your FTP client
4. The server will automatically use the IP you connected to for passive mode

### Manual Configuration (Optional)

Only needed if auto-detection doesn't work or you need a specific IP.

#### 1. Find Your Server's External IP Address

**For local network access:**
```bash
# On Linux/Mac
hostname -I | awk '{print $1}'

# Or check your router settings for the server's IP
# Example: 192.168.1.100
```

**For internet access:**
```bash
# Get your public IP
curl ifconfig.me

# Example: 203.0.113.45
```

#### 2. Set the FTP_PASV_URL Environment Variable

Edit your `.env` file:

```env
FTP_PASV_URL=192.168.1.100
```

Or in `docker-compose.yml`:
```yaml
environment:
  - FTP_PASV_URL=192.168.1.100
```

#### 3. Restart the Container

```bash
docker compose down
docker compose up -d
```

### Verify Configuration

Check the logs to see which PASV URL is being used:

```bash
docker logs paiperless | grep PASV
```

You should see one of:
- `Using PASV URL from environment: 192.168.1.100`
- `Using PASV URL from Paperless URL: 192.168.1.100`
- `Auto-detected PASV URL: 192.168.1.100`

## Firewall Configuration

If you're accessing the FTP server from outside your local network, ensure your firewall allows:

- **Inbound TCP port 21** (FTP control)
- **Inbound TCP ports 1024-1048** (FTP passive data)

### Example UFW Configuration (Ubuntu/Debian)

```bash
sudo ufw allow 21/tcp
sudo ufw allow 1024:1048/tcp
```

### Example firewalld Configuration (CentOS/RHEL)

```bash
sudo firewall-cmd --permanent --add-port=21/tcp
sudo firewall-cmd --permanent --add-port=1024-1048/tcp
sudo firewall-cmd --reload
```

## Router Configuration (Port Forwarding)

If accessing from the internet, configure port forwarding on your router:

1. Forward external port 21 → internal port 21 (server IP)
2. Forward external ports 1024-1048 → internal ports 1024-1048 (server IP)

## Testing the FTP Server

### From Command Line

```bash
# Test FTP connection
ftp 192.168.1.100

# Or with lftp
lftp -u username 192.168.1.100
```

### From FTP Client (FileZilla, WinSCP, etc.)

1. **Host:** Your server IP or hostname
2. **Port:** 21
3. **Protocol:** FTP (not SFTP)
4. **Username:** Configured in pAIperless dashboard
5. **Password:** Configured in pAIperless dashboard
6. **Transfer Mode:** Passive (PASV)

## Common Issues

### Error: "Die Datenverbindung konnte nicht hergestellt werden"

**Cause:** The FTP_PASV_URL is not set correctly or passive ports are not accessible.

**Solution:**
1. Verify `FTP_PASV_URL` matches your server's external IP
2. Check firewall rules for ports 1024-1048
3. Restart the Docker container after configuration changes

### Connection Timeout in Passive Mode

**Cause:** Firewall blocking passive data ports.

**Solution:**
1. Open ports 1024-1048 in your firewall
2. Configure router port forwarding if accessing from internet

### "Connection refused" on Port 21

**Cause:** FTP server is not running or port not exposed.

**Solution:**
1. Check server status in pAIperless dashboard (Settings → FTP Server)
2. Verify port 21 is mapped in docker-compose.yml
3. Check Docker container logs: `docker logs paiperless`

## Security Recommendations

### For Local Network Use

- Use FTP without TLS (FTPS is not yet implemented)
- Ensure strong password for FTP user
- Restrict access via firewall to local network only

### For Internet Use

- **IMPORTANT:** FTP without encryption transmits credentials in plain text
- Consider using VPN for secure access instead of exposing FTP to internet
- Use strong, unique passwords
- Monitor logs for unauthorized access attempts

### Planned Security Features

- FTPS (FTP over TLS) support
- Certificate management
- IP whitelist/blacklist
- Connection rate limiting

## Configuration in pAIperless

After network configuration, enable and configure the FTP server in the pAIperless dashboard:

1. Navigate to **Dashboard → Settings → FTP Server**
2. Enable the FTP server
3. Set username and password
4. Configure port (default: 21)
5. Save and restart the service

## Troubleshooting

### View FTP Server Logs

```bash
# View container logs
docker logs -f paiperless | grep FTP

# View all logs
docker logs paiperless
```

### Test Passive Mode

```bash
# Connect with lftp and enable debug
lftp -u username -e "debug 3; ls; bye" 192.168.1.100
```

### Verify Port Accessibility

```bash
# Test port 21
nc -zv 192.168.1.100 21

# Test passive ports
nc -zv 192.168.1.100 1024
```

## Environment Variables Reference

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `FTP_PASV_URL` | External IP/hostname for passive mode | `192.168.1.100` | Yes |
| `FTP_ENABLED` | Enable/disable FTP server | `true` | No (configured in dashboard) |
| `FTP_USERNAME` | FTP username | `paiperless` | No (configured in dashboard) |
| `FTP_PASSWORD` | FTP password | (encrypted) | No (configured in dashboard) |
| `FTP_PORT` | FTP control port | `21` | No (configured in dashboard) |

## Support

If you encounter issues:

1. Check the logs: `docker logs paiperless`
2. Verify network configuration (IP, ports, firewall)
3. Test from different clients (command line, FileZilla, etc.)
4. Report issues at: https://github.com/yourusername/paiperless/issues
