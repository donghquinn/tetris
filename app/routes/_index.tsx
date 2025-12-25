import { useEffect, useRef, useState, useCallback } from "react";
import type { MetaFunction } from "@remix-run/node";
import "~/styles/game.css";

export const meta: MetaFunction = () => {
  return [
    { title: "Tetris Game" },
    { name: "description", content: "Play Tetris!" },
  ];
};

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const COLORS = [
  null,
  '#00f0f0', // I - Cyan
  '#f0f000', // O - Yellow
  '#a000f0', // T - Purple
  '#00f000', // S - Green
  '#f00000', // Z - Red
  '#0000f0', // J - Blue
  '#f0a000'  // L - Orange
];

const SHAPES = [
  [],
  [[1,1,1,1]], // I
  [[1,1],[1,1]], // O
  [[0,1,0],[1,1,1]], // T
  [[0,1,1],[1,1,0]], // S
  [[1,1,0],[0,1,1]], // Z
  [[1,0,0],[1,1,1]], // J
  [[0,0,1],[1,1,1]]  // L
];

type Board = number[][];
type Shape = number[][];

interface Piece {
  type: number;
  shape: Shape;
  color: string;
  x: number;
  y: number;
}

export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const [board, setBoard] = useState<Board>(() =>
    Array(ROWS).fill(null).map(() => Array(COLS).fill(0))
  );
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<number | null>(null);

  const boardRef = useRef(board);
  const currentPieceRef = useRef(currentPiece);
  const gameOverRef = useRef(gameOver);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    currentPieceRef.current = currentPiece;
  }, [currentPiece]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const createPiece = useCallback((type: number): Piece => {
    return {
      type,
      shape: SHAPES[type].map(row => [...row]),
      color: COLORS[type]!,
      x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2),
      y: 0
    };
  }, []);

  const randomPiece = useCallback(() => {
    return Math.floor(Math.random() * 7) + 1;
  }, []);

  const collides = useCallback((piece: Piece, offsetX = 0, offsetY = 0): boolean => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = piece.x + x + offsetX;
          const newY = piece.y + y + offsetY;

          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }

          if (newY >= 0 && boardRef.current[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const getGhostY = useCallback((piece: Piece): number => {
    let ghostY = piece.y;
    while (!collides(piece, 0, ghostY - piece.y + 1)) {
      ghostY++;
    }
    return ghostY;
  }, [collides]);

  const drawBlock = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    size = BLOCK_SIZE
  ) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * size, y * size, size, size);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * size, y * size, size, size);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x * size, y * size, size / 4, size / 4);
  }, []);

  const drawBoard = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (boardRef.current[y][x]) {
          drawBlock(ctx, x, y, COLORS[boardRef.current[y][x]]!);
        }
      }
    }
  }, [drawBlock]);

  const drawPiece = useCallback((
    ctx: CanvasRenderingContext2D,
    piece: Piece,
    offsetX = 0,
    offsetY = 0,
    size = BLOCK_SIZE
  ) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          drawBlock(ctx, piece.x + x + offsetX, piece.y + y + offsetY, piece.color, size);
        }
      }
    }
  }, [drawBlock]);

  const drawGhostPiece = useCallback((ctx: CanvasRenderingContext2D, piece: Piece) => {
    const ghostY = getGhostY(piece);

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const posX = (piece.x + x) * BLOCK_SIZE;
          const posY = (ghostY + y) * BLOCK_SIZE;

          ctx.strokeStyle = piece.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(posX, posY, BLOCK_SIZE, BLOCK_SIZE);

          ctx.fillStyle = piece.color + '20';
          ctx.fillRect(posX, posY, BLOCK_SIZE, BLOCK_SIZE);
        }
      }
    }
  }, [getGhostY]);

  const drawNext = useCallback(() => {
    const nextCanvas = nextCanvasRef.current;
    if (!nextCanvas || nextPiece === null) return;

    const ctx = nextCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    const tempPiece = createPiece(nextPiece);
    const size = 25;
    const offsetX = (4 - tempPiece.shape[0].length) / 2;
    const offsetY = (4 - tempPiece.shape.length) / 2;

    for (let y = 0; y < tempPiece.shape.length; y++) {
      for (let x = 0; x < tempPiece.shape[y].length; x++) {
        if (tempPiece.shape[y][x]) {
          drawBlock(ctx, x + offsetX, y + offsetY, tempPiece.color, size);
        }
      }
    }
  }, [nextPiece, createPiece, drawBlock]);

  const mergePiece = useCallback((piece: Piece) => {
    const newBoard = boardRef.current.map(row => [...row]);

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          if (piece.y + y < 0) {
            setGameOver(true);
            return newBoard;
          }
          newBoard[piece.y + y][piece.x + x] = piece.type;
        }
      }
    }

    return newBoard;
  }, []);

  const clearLines = useCallback((currentBoard: Board) => {
    let linesCleared = 0;
    const newBoard = [...currentBoard];

    for (let y = ROWS - 1; y >= 0; y--) {
      if (newBoard[y].every(cell => cell !== 0)) {
        newBoard.splice(y, 1);
        newBoard.unshift(Array(COLS).fill(0));
        linesCleared++;
        y++;
      }
    }

    if (linesCleared > 0) {
      const newLines = lines + linesCleared;
      const points = [0, 100, 300, 500, 800][linesCleared];
      const newLevel = Math.floor(newLines / 10) + 1;

      setLines(newLines);
      setScore(prev => prev + points * level);
      setLevel(newLevel);
    }

    return newBoard;
  }, [lines, level]);

  const rotatePiece = useCallback(() => {
    if (!currentPieceRef.current || gameOverRef.current || isPausedRef.current) return;

    const piece = currentPieceRef.current;
    const newShape = piece.shape[0].map((_, i) =>
      piece.shape.map(row => row[i]).reverse()
    );

    const rotatedPiece = { ...piece, shape: newShape };

    if (!collides(rotatedPiece)) {
      setCurrentPiece(rotatedPiece);
    }
  }, [collides]);

  const movePiece = useCallback((offsetX: number, offsetY: number): boolean => {
    if (!currentPieceRef.current || gameOverRef.current || isPausedRef.current) return false;

    const piece = currentPieceRef.current;
    const newPiece = { ...piece, x: piece.x + offsetX, y: piece.y + offsetY };

    if (!collides(newPiece)) {
      setCurrentPiece(newPiece);
      return true;
    }
    return false;
  }, [collides]);

  const hardDrop = useCallback(() => {
    if (!currentPieceRef.current || gameOverRef.current || isPausedRef.current) return;

    let piece = currentPieceRef.current;
    while (!collides(piece, 0, 1)) {
      piece = { ...piece, y: piece.y + 1 };
    }

    const mergedBoard = mergePiece(piece);
    const clearedBoard = clearLines(mergedBoard);
    setBoard(clearedBoard);

    const nextType = randomPiece();
    const newPiece = createPiece(nextPiece!);

    if (collides(newPiece)) {
      setGameOver(true);
    }

    setCurrentPiece(newPiece);
    setNextPiece(nextType);
  }, [collides, mergePiece, clearLines, randomPiece, createPiece, nextPiece]);

  const newPiece = useCallback(() => {
    const nextType = randomPiece();
    const pieceType = nextPiece ?? randomPiece();
    const piece = createPiece(pieceType);

    if (collides(piece)) {
      setGameOver(true);
    }

    setCurrentPiece(piece);
    setNextPiece(nextType);
  }, [randomPiece, createPiece, nextPiece, collides]);

  const restartGame = useCallback(() => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(0)));
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setIsPaused(false);
    setNextPiece(null);
    setCurrentPiece(null);

    setTimeout(() => {
      const nextType = randomPiece();
      const pieceType = randomPiece();
      setCurrentPiece(createPiece(pieceType));
      setNextPiece(nextType);
    }, 0);
  }, [randomPiece, createPiece]);

  useEffect(() => {
    newPiece();
  }, []);

  useEffect(() => {
    drawNext();
  }, [nextPiece, drawNext]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentPiece) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBoard(ctx);
    drawGhostPiece(ctx, currentPiece);
    drawPiece(ctx, currentPiece);
  }, [board, currentPiece, drawBoard, drawGhostPiece, drawPiece]);

  useEffect(() => {
    if (gameOver || isPaused || !currentPiece) return;

    const dropInterval = Math.max(100, 1000 - (level - 1) * 100);

    const interval = setInterval(() => {
      if (!movePiece(0, 1)) {
        const mergedBoard = mergePiece(currentPieceRef.current!);
        const clearedBoard = clearLines(mergedBoard);
        setBoard(clearedBoard);

        const nextType = randomPiece();
        const newPiece = createPiece(nextPiece!);

        if (collides(newPiece)) {
          setGameOver(true);
        }

        setCurrentPiece(newPiece);
        setNextPiece(nextType);
      }
    }, dropInterval);

    return () => clearInterval(interval);
  }, [level, gameOver, isPaused, currentPiece, movePiece, mergePiece, clearLines, randomPiece, createPiece, nextPiece, collides]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOverRef.current && e.key !== 'p' && e.key !== 'P') return;

      if (e.key === 'p' || e.key === 'P') {
        if (!gameOverRef.current) {
          setIsPaused(prev => !prev);
        }
        return;
      }

      if (isPausedRef.current) return;

      switch(e.key) {
        case 'ArrowLeft':
          movePiece(-1, 0);
          break;
        case 'ArrowRight':
          movePiece(1, 0);
          break;
        case 'ArrowDown':
          movePiece(0, 1);
          break;
        case 'ArrowUp':
          rotatePiece();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePiece, rotatePiece, hardDrop]);

  return (
    <div className="game-container">
      <h1 className="game-title">TETRIS</h1>
      <div className="game-content">
        <div style={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            id="gameCanvas"
            width={COLS * BLOCK_SIZE}
            height={ROWS * BLOCK_SIZE}
          />
          {isPaused && (
            <div className="pause-overlay">PAUSED</div>
          )}
          {gameOver && (
            <div className="game-over">
              <h1>GAME OVER</h1>
              <p>Score: <span>{score}</span></p>
              <button onClick={restartGame}>Play Again</button>
            </div>
          )}
        </div>
        <div className="side-panel">
          <div className="info-box">
            <h2>Score</h2>
            <p>{score}</p>
          </div>
          <div className="info-box">
            <h2>Level</h2>
            <p>{level}</p>
          </div>
          <div className="info-box">
            <h2>Lines</h2>
            <p>{lines}</p>
          </div>
          <div className="info-box">
            <h2>Next</h2>
            <canvas
              ref={nextCanvasRef}
              width={120}
              height={120}
              className="next-piece-canvas"
            />
          </div>
          <div className="controls">
            <h2>Controls</h2>
            <p><span>Move Left</span><span className="key">←</span></p>
            <p><span>Move Right</span><span className="key">→</span></p>
            <p><span>Soft Drop</span><span className="key">↓</span></p>
            <p><span>Hard Drop</span><span className="key">Space</span></p>
            <p><span>Rotate</span><span className="key">↑</span></p>
            <p><span>Pause</span><span className="key">P</span></p>
          </div>
          <button className="reset-button" onClick={restartGame}>
            Reset Game
          </button>
        </div>
      </div>
    </div>
  );
}
