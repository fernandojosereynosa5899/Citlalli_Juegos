const http = require('http');

const paths = [
  '/arcade/',
  '/arcade/css/arcade.css',
  '/arcade/js/config.js',
  '/arcade/js/util.js',
  '/arcade/js/assets.js',
  '/arcade/js/audio.js',
  '/arcade/js/storage.js',
  '/arcade/js/engine.js',
  '/arcade/js/ui.js',
  '/arcade/js/games/snake.js',
  '/arcade/js/games/flappy.js',
  '/arcade/js/games/memorama.js',
  '/arcade/js/games/reflejos.js',
  '/arcade/js/main.js',
  '/pixel-art/cabinet/citlalli_arcade_marquee.png',
  '/pixel-art/cabinet/citlalli_trophy_emblem.png',
  '/pixel-art/scenarios/scenario_hidalgo.png',
  '/pixel-art/scenarios/scenario_jaguar.png',
  '/pixel-art/scenarios/scenario_velvet.png',
  '/pixel-art/scenarios/scenario_penthouse.png',
  '/pixel-art/sprites/bottle_citlalli.png',
  '/pixel-art/sprites/bottle_winged.png',
  '/pixel-art/sprites/charm_qm.png',
  '/pixel-art/sprites/jaguar_gold.png',
  '/pixel-art/sprites/star_citlalli.png',
  '/pixel-art/sprites/mandarin.png',
  '/pixel-art/sprites/rose_pink.png',
  '/pixel-art/sprites/jasmine_white.png',
  '/pixel-art/sprites/vanilla_pod.png',
  '/pixel-art/sprites/amber_crystal.png',
  '/pixel-art/sprites/clay_vessel.png',
  '/pixel-art/sprites/snake_head_gold.png',
  '/pixel-art/sprites/snake_head_rosegold.png',
  '/pixel-art/sprites/smoke_hazard.png',
  '/pixel-art/sprites/card_back_velvet.png'
];

Promise.all(paths.map(p => new Promise((resolve, reject) => {
  http.get('http://localhost:8080' + p, res => {
    if (res.statusCode !== 200) {
      reject(new Error(`${p} returned ${res.statusCode}`));
    } else {
      resolve(`${p} -> 200 OK`);
    }
  }).on('error', reject);
}))).then(results => {
  console.log(`SUCCESS: All ${results.length} files verified with 200 OK.`);
}).catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
