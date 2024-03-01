const dgram = require('dgram');
const mqtt = require('mqtt');
const server = dgram.createSocket('udp4');
const mqttClient = mqtt.connect('mqtt://127.0.0.1'); // Utiliza cualquier broker MQTT público o tu propio broker

const MQTT_TOPIC = '/servidorUDP/#'; // El tópico al que te suscribes para recibir comandos
const UDP_PORT = 5000; // Puerto para clientes UDP

server.on('error', (err) => {
  console.log(`Server error:\n${err.stack}`);
  server.close();
});

 //{"nserie":"LB-PDU4-000335","tomas":{"1":"ON","2":"ON","3":"ON","4":"ON"}}
server.on('message', (msg, rinfo) => {
    console.log(`Server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  
    // Decodifica el mensaje a un string
    const messageText = msg.toString();
    console.log(`Mensaje decodificado: ${messageText}`);

    // Separa el mensaje por comas
    const parts = messageText.split(',');
    // Extrae el ID del dispositivo y asume que el resto son estados de relays
    const deviceId = parts[0];
    // Saltea "RELAYS" y comienza con los estados
    const relayStates = parts.slice(2);

    // Convierte los estados de relay a un objeto con claves numeradas desde 1
    let tomas = {};
    relayStates.forEach((state, index) => {
        tomas[index + 1] = state;
    });

    // Construye el mensaje MQTT
    const mqttMessage = JSON.stringify({
        nserie: deviceId,
        tomas: tomas
    });

    // Publica el mensaje MQTT
    mqttClient.publish("/servidor/", mqttMessage, (err) => {
        if (err) {
            console.log('Error al publicar mensaje MQTT:', err);
        } else {
            console.log(`Mensaje MQTT publicado en el tópico '${MQTT_TOPIC}': ${mqttMessage}`);
        }
    });
});
server.on('listening', () => {
  const address = server.address();
  console.log(`Server listening ${address.address}:${address.port}`);
});

// Inicia la escucha de mensajes UDP
server.bind(UDP_PORT);

// MQTT Client
mqttClient.on('connect', () => {
  console.log('Conectado al broker MQTT');
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (!err) {
      console.log(`Suscrito al tópico '${MQTT_TOPIC}'`);
    }
  });
});
mqttClient.on('message', (topic, message) => {
  console.log(`Mensaje recibido en el tópico '${topic}': ${message}`);

  // Parseamos el mensaje JSON
  let parsedMessage;
  try {
    parsedMessage = JSON.parse(message);
  } catch (error) {
    console.error('Error al parsear el mensaje:', error);
    return;
  }

  // Verificamos que el mensaje tenga la estructura esperada
  if (!parsedMessage.section || parsedMessage.section !== "RELAY" || !parsedMessage.action || !parsedMessage.relay) {
    console.error('El mensaje no tiene la estructura esperada.');
    return;
  }

  // Definimos la dirección IP y el puerto del dispositivo Arduino
  const arduinoIp = '192.168.1.200';
  const arduinoPort = 8888;

  // Construimos el mensaje a enviar
  const relayNumber = parseInt(parsedMessage.relay, 10);
  const relayAction = parsedMessage.action.toUpperCase();
  const deviceId = "LB-PDU4-000173";
  const mensaje = `${deviceId},RELAYS,${relayNumber},${relayAction}`;

  console.log('Mensaje a enviar al Arduino:', mensaje);

  // Convertimos el mensaje a un Buffer para enviarlo
  const messageBuffer = Buffer.from(mensaje);

  // Enviamos el mensaje al Arduino
  server.send(messageBuffer, arduinoPort, parsedMessage.ip, (err) => {
    if (err) {
      console.error('Error al enviar el mensaje al Arduino:', err);
    } else {
      console.log('Mensaje enviado al Arduino:', mensaje);
    }
  });
});
