# Expo Go phone testing

For iPhone/Expo Go testing, do not scan a QR code that points at `127.0.0.1` or localhost. Start Expo with LAN mode first: `npx expo start --host lan`. Use tunnel mode only when LAN is not possible: `npx expo start --host tunnel`.

The phone and laptop must be on the same Wi-Fi network for LAN mode. Turn off VPNs while testing if the phone cannot connect.

On Windows, make sure the current network is Private and Windows Firewall allows Node.js/Expo through the private network. If tunnel mode fails because of ngrok/tunnel connectivity, that is a development network issue rather than a FEN app-code issue.
