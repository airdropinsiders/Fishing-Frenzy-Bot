import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from './logger.js';

export async function fishing(token, type = '1', proxy) {
    const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
    if (type === '1') {
        type = 'short_range'
    } else if (type === '2') { 
        type = 'mid_range'
    } else {
        type = 'long_range'
    }
    const url = `wss://fishing-frenzy-api-0c12a800fbfe.herokuapp.com/?token=${token}`;

    const ws = new WebSocket(url, { agent });

    let isGameInitialized = false;
    let frames = [];
    let frameCount = 0;
    let startTime = Date.now();
    const maxFrames = 15;
    const fps = 20;

    const startNewGame = () => {
        if (!isGameInitialized) {
            const message = JSON.stringify({ cmd: "prepare", range: type });
            ws.send(message);
            logger('Prepare For Fishing...');
        } else {
            const start = JSON.stringify({ cmd: "start" });
            setTimeout(() => {
                ws.send(start);
                logger('Fishing Starting...');
            }, 1000);
        }
    };

    const endGame = () => {
        let endTime = Date.now();
        let durationInSeconds = Math.floor((endTime - startTime) / 1000);
        let fpsCalculated = frameCount / durationInSeconds;

        const endResponse = {
            cmd: "end",
            rep: {
                fs: frameCount,
                ns: frames.length,
                fps: fpsCalculated,
                frs: frames,
            },
            en: 1,
        };
        ws.send(JSON.stringify(endResponse));
    };

    const handleGameState = (message) => {
        if (message.type === 'gameState') {
            frameCount++;
            let x = calculatePositionX(message.frame, message.dir);
            let y = calculatePositionY(message.frame, message.dir);

            frames.push([x, y]);
            if (frameCount >= maxFrames) {
                endGame();
            }
        }
    };

    const calculatePositionX = (frame, dir) => {
        return 450 + frame * 2 + dir * 5;
    };

    const calculatePositionY = (frame, dir) => {
        return 426 + frame * 2 - dir * 3;
    };

    let fish;
    ws.on('open', function open() {
        logger(`Connected to WebSocket server using proxy: ${proxy}`);
        startNewGame();
    });

    ws.on('message', function incoming(data) {
        const message = data.toString();
        try {
            const parsedData = JSON.parse(message);

            if (parsedData.type === 'initGame') {
                fish = parsedData.data.randomFish.fishName;
                logger("Trying to Catch Fish: ",'info', fish);

                isGameInitialized = true;
                startNewGame();
            }
            if (parsedData.type === 'gameState') {
                handleGameState(parsedData);
            }

            if (parsedData.type === 'gameOver') {
                const energy = parsedData.catchedFish.energy;
                if (parsedData.success) {
                    logger(`Game succeeded! Fish Catched: ${fish} Energy Left: ${energy}`, 'success');
                } else {
                    logger('Game failed:', 'error', parsedData);
                }
            }
        } catch (error) {
            logger('Failed to parse message:', 'error');
        }
    });
}
