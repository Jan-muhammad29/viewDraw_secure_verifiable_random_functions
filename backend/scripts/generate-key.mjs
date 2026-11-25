import {randomBytes} from 'node:crypto';
console.log('NEW VRF_PRIVATE_KEY_HEX='+randomBytes(32).toString('hex'));
console.log('Copy only to backend/.env or cloud secret store. Never commit or share this value.');
