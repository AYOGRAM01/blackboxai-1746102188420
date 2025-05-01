const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

const playerWidth = 40;
const playerHeight = 40;
const playerSpeed = 5;
const bulletSpeed = 7;
const enemySpeed = 2;
const enemySpawnBaseInterval = 1500; // base spawn interval in ms
const powerUpDuration = 8000; // power-up lasts 8 seconds

// Game state
let playerX = canvasWidth / 2 - playerWidth / 2;
let playerY = canvasHeight - playerHeight - 10;
let leftPressed = false;
let rightPressed = false;
let spacePressed = false;
let bullets = [];
let enemies = [];
let powerUps = [];
let explosions = [];
let score = 0;
let lives = 3;
let gameOver = false;
let paused = false;
let level = 1;
let enemySpawnInterval = enemySpawnBaseInterval;
let lastEnemySpawnTime = 0;
let lastShotTime = 0;
let rapidFire = false;
let rapidFireEndTime = 0;
let boss = null;
let bossActive = false;

// Load images
const playerImg = new Image();
playerImg.src = 'https://cdn-icons-png.flaticon.com/512/3082/3082037.png';

const enemyImgs = [
  'https://cdn-icons-png.flaticon.com/512/616/616408.png',
  'https://cdn-icons-png.flaticon.com/512/616/616490.png',
  'https://cdn-icons-png.flaticon.com/512/616/616491.png'
].map(src => {
  const img = new Image();
  img.src = src;
  return img;
});

const powerUpImg = new Image();
powerUpImg.src = 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png';

const bossImg = new Image();
bossImg.src = 'https://cdn-icons-png.flaticon.com/512/616/616554.png';

// Load sounds
const shootSound = document.getElementById('shootSound');
const explosionSound = document.getElementById('explosionSound');
const gameOverSound = document.getElementById('gameOverSound');
const bossHitSound = new Audio('https://freesound.org/data/previews/256/256113_3263906-lq.mp3');
const bossDefeatSound = new Audio('https://freesound.org/data/previews/331/331912_324703-lq.mp3');

// Event listeners
document.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') leftPressed = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') rightPressed = true;
  if (e.code === 'Space') spacePressed = true;
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') leftPressed = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') rightPressed = false;
  if (e.code === 'Space') spacePressed = false;
});

document.getElementById('pauseButton').addEventListener('click', () => {
  paused = !paused;
  document.getElementById('pauseButton').textContent = paused ? 'Resume' : 'Pause';
  if (!paused && !gameOver) {
    gameLoop();
    spawnEnemiesLoop();
  }
});

// Classes
class Bullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 6;
    this.height = 12;
  }
  update() {
    this.y -= bulletSpeed;
  }
  draw() {
    ctx.fillStyle = '#0ff';
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = 40 + type * 10;
    this.height = 40 + type * 10;
    this.speed = enemySpeed + type * 0.5;
    this.img = enemyImgs[type];
  }
  update() {
    this.y += this.speed;
  }
  draw() {
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }
}

class PowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 30;
    this.height = 30;
    this.speed = 2;
  }
  update() {
    this.y += this.speed;
  }
  draw() {
    ctx.drawImage(powerUpImg, this.x, this.y, this.width, this.height);
  }
}

class Explosion {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = 30;
  }
  update() {
    this.radius += 2;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(0, 255, 255, ${1 - this.radius / this.maxRadius})`;
    ctx.fill();
  }
  isDone() {
    return this.radius >= this.maxRadius;
  }
}

class Boss {
  constructor() {
    this.width = 120;
    this.height = 120;
    this.x = canvasWidth / 2 - this.width / 2;
    this.y = -this.height;
    this.speedY = 1;
    this.speedX = 2;
    this.health = 30;
    this.maxHealth = 30;
    this.direction = 1;
    this.img = bossImg;
  }
  update() {
    if (this.y < 50) {
      this.y += this.speedY;
    } else {
      this.x += this.speedX * this.direction;
      if (this.x <= 0 || this.x + this.width >= canvasWidth) {
        this.direction *= -1;
      }
    }
  }
  draw() {
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    // Draw health bar
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x, this.y - 10, this.width, 5);
    ctx.fillStyle = 'lime';
    ctx.fillRect(this.x, this.y - 10, (this.health / this.maxHealth) * this.width, 5);
  }
}

// Spawn enemies at random x positions with random types
function spawnEnemy() {
  if (bossActive) return; // no regular enemies during boss fight
  const x = Math.random() * (canvasWidth - 50);
  const type = Math.floor(Math.random() * enemyImgs.length);
  enemies.push(new Enemy(x, -50, type));
}

// Spawn power-ups occasionally
function spawnPowerUp() {
  const x = Math.random() * (canvasWidth - 30);
  powerUps.push(new PowerUp(x, -30));
}

// Check collision between two rectangles
function isColliding(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

// Update game state
function update() {
  if (gameOver || paused) return;

  // Move player
  if (leftPressed && playerX > 0) playerX -= playerSpeed;
  if (rightPressed && playerX < canvasWidth - playerWidth) playerX += playerSpeed;

  // Shoot bullets with rate limit
  const now = Date.now();
  if (spacePressed && (rapidFire || now - lastShotTime > 300)) {
    const bullet = new Bullet(playerX + playerWidth / 2 - 3, playerY);
    bullets.push(bullet);
    shootSound.currentTime = 0;
    shootSound.play();
    lastShotTime = now;
  }

  // Update bullets
  bullets = bullets.filter(bullet => bullet.y + bullet.height > 0);
  bullets.forEach(bullet => bullet.update());

  // Update enemies
  enemies.forEach((enemy, eIndex) => {
    enemy.update();

    // Check if enemy reached bottom (lose life)
    if (enemy.y > canvasHeight) {
      enemies.splice(eIndex, 1);
      lives--;
      updateLives();
      if (lives <= 0) {
        endGame();
      }
    }

    // Check collision with bullets
    bullets.forEach((bullet, bIndex) => {
      if (isColliding(bullet, enemy)) {
        explosions.push(new Explosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2));
        explosionSound.currentTime = 0;
        explosionSound.play();
        enemies.splice(eIndex, 1);
        bullets.splice(bIndex, 1);
        score += 10;
        updateScore();

        // Chance to spawn power-up
        if (Math.random() < 0.1) {
          spawnPowerUp();
        }
      }
    });

    // Check collision with player (lose life)
    const playerRect = { x: playerX, y: playerY, width: playerWidth, height: playerHeight };
    if (isColliding(playerRect, enemy)) {
      explosions.push(new Explosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2));
      explosionSound.currentTime = 0;
      explosionSound.play();
      enemies.splice(eIndex, 1);
      lives--;
      updateLives();
      if (lives <= 0) {
        endGame();
      }
    }
  });

  // Update power-ups
  powerUps.forEach((powerUp, pIndex) => {
    powerUp.update();

    // Remove if off screen
    if (powerUp.y > canvasHeight) {
      powerUps.splice(pIndex, 1);
    }

    // Check collision with player (activate power-up)
    const playerRect = { x: playerX, y: playerY, width: playerWidth, height: playerHeight };
    if (isColliding(playerRect, powerUp)) {
      powerUps.splice(pIndex, 1);
      activatePowerUp();
    }
  });

  // Update explosions
  explosions.forEach((explosion, index) => {
    explosion.update();
    if (explosion.isDone()) {
      explosions.splice(index, 1);
    }
  });

  // Boss logic
  if (bossActive && boss) {
    boss.update();

    // Check collision with bullets
    bullets.forEach((bullet, bIndex) => {
      const bossRect = { x: boss.x, y: boss.y, width: boss.width, height: boss.height };
      if (isColliding(bullet, bossRect)) {
        boss.health--;
        bossHitSound.currentTime = 0;
        bossHitSound.play();
        bullets.splice(bIndex, 1);
        explosions.push(new Explosion(bullet.x, bullet.y));
        if (boss.health <= 0) {
          explosions.push(new Explosion(boss.x + boss.width / 2, boss.y + boss.height / 2));
          bossDefeatSound.currentTime = 0;
          bossDefeatSound.play();
          bossActive = false;
          boss = null;
          score += 100;
          updateScore();
          level++;
          enemySpawnInterval = Math.max(500, enemySpawnBaseInterval - level * 100);
        }
      }
    });

    // Check collision with player (lose life)
    const playerRect = { x: playerX, y: playerY, width: playerWidth, height: playerHeight };
    const bossRect = { x: boss.x, y: boss.y, width: boss.width, height: boss.height };
    if (isColliding(playerRect, bossRect)) {
      explosions.push(new Explosion(boss.x + boss.width / 2, boss.y + boss.height / 2));
      explosionSound.currentTime = 0;
      explosionSound.play();
      lives--;
      updateLives();
      if (lives <= 0) {
        endGame();
      }
    }
  } else {
    // Spawn boss every 5 levels
    if (level > 1 && level % 5 === 0 && !bossActive) {
      boss = new Boss();
      bossActive = true;
      enemies = [];
      powerUps = [];
    }
  }
}

// Activate power-up (rapid fire)
function activatePowerUp() {
  rapidFire = true;
  rapidFireEndTime = Date.now() + powerUpDuration;
}

// Update score display
function updateScore() {
  document.getElementById('score').textContent = score;
}

// Update lives display
function updateLives() {
  document.getElementById('lives').textContent = lives;
}

// End game
function endGame() {
  gameOver = true;
  gameOverSound.play();
  document.getElementById('pauseButton').disabled = true;
}

// Draw game elements
function draw() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw starfield background
  drawStarfield();

  // Draw player
  ctx.drawImage(playerImg, playerX, playerY, playerWidth, playerHeight);

  // Draw bullets
  bullets.forEach(bullet => bullet.draw());

  // Draw enemies
  enemies.forEach(enemy => enemy.draw());

  // Draw power-ups
  powerUps.forEach(powerUp => powerUp.draw());

  // Draw explosions
  explosions.forEach(explosion => explosion.draw());

  // Draw boss
  if (bossActive && boss) {
    boss.draw();
  }

  // Draw game over message
  if (gameOver) {
    ctx.fillStyle = 'red';
    ctx.font = '48px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvasWidth / 2, canvasHeight / 2);
    ctx.font = '24px Orbitron, monospace';
    ctx.fillText('Refresh to play again', canvasWidth / 2, canvasHeight / 2 + 40);
  }
}

// Starfield background
const stars = [];
const numStars = 100;
for (let i = 0; i < numStars; i++) {
  stars.push({
    x: Math.random() * canvasWidth,
    y: Math.random() * canvasHeight,
    radius: Math.random() * 1.5,
    speed: Math.random() * 0.5 + 0.1
  });
}

function drawStarfield() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#0ff';
  stars.forEach(star => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, 2 * Math.PI);
    ctx.fill();
    star.y += star.speed;
    if (star.y > canvasHeight) {
      star.y = 0;
      star.x = Math.random() * canvasWidth;
    }
  });
}

// Game loop
function gameLoop() {
  if (paused || gameOver) return;
  update();
  draw();
  if (rapidFire && Date.now() > rapidFireEndTime) {
    rapidFire = false;
  }
  requestAnimationFrame(gameLoop);
}

// Spawn enemies at intervals
function spawnEnemiesLoop() {
  if (gameOver || paused) return;
  const now = Date.now();
  if (now - lastEnemySpawnTime > enemySpawnInterval) {
    spawnEnemy();
    lastEnemySpawnTime = now;
  }
  requestAnimationFrame(spawnEnemiesLoop);
}

// Start the game
playerImg.onload = () => {
  bossImg.onload = () => {
    enemyImgs[enemyImgs.length - 1].onload = () => {
      gameLoop();
      spawnEnemiesLoop();
    };
  };
};

updateScore();
updateLives();
