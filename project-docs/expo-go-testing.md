# Expo Go phone testing

For iPhone/Expo Go testing, do not scan a QR code that points at `127.0.0.1` or localhost. Start Expo with LAN or tunnel mode, for example `npx expo start --host lan` or `npx expo start --host tunnel`.

On Windows, make sure the current network is Private and Windows Firewall allows Node/Expo through the private network. If tunnel mode fails because of ngrok/tunnel connectivity, that is a development network issue rather than a FEN app-code issue.
