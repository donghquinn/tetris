import { useEffect, useRef, useState, useCallback } from "react";
import type { MetaFunction } from "@remix-run/node";
import "~/styles/game.css";

export const meta: MetaFunction = () => {
  return [
    { title: "Donghyun's Tetris" },
    { name: "description", content: "Play Tetris!" },
  ];
};

const COLS = 12;
const ROWS = 24;
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

interface ScoreItem {
  score_seq: number;
  user_id: string;
  user_nickname: string;
  score_point: number;
  score_level: number;
  score_line: number;
  score_combo: number;
  created_at: string;
}

export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvas2Ref = useRef<HTMLCanvasElement>(null);
  const [board, setBoard] = useState<Board>(() =>
    Array(ROWS).fill(null).map(() => Array(COLS).fill(0))
  );
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<number | null>(null);
  const [nextPiece2, setNextPiece2] = useState<number | null>(null);
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false);
  const [nickname, setNickname] = useState("");
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<ScoreItem[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  const boardRef = useRef(board);
  const currentPieceRef = useRef(currentPiece);
  const gameOverRef = useRef(gameOver);
  const isPausedRef = useRef(isPaused);
  const pieceBagRef = useRef<number[]>([]);

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

  const shuffleBag = useCallback(() => {
    const bag = [1, 2, 3, 4, 5, 6, 7];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }, []);

  const randomPiece = useCallback(() => {
    if (pieceBagRef.current.length === 0) {
      pieceBagRef.current = shuffleBag();
    }
    return pieceBagRef.current.pop()!;
  }, [shuffleBag]);

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


  const drawNext = useCallback(() => {
    // Draw first next piece
    const nextCanvas = nextCanvasRef.current;
    if (nextCanvas && nextPiece !== null) {
      const ctx = nextCanvas.getContext('2d');
      if (ctx) {
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
      }
    }

    // Draw second next piece
    const nextCanvas2 = nextCanvas2Ref.current;
    if (nextCanvas2 && nextPiece2 !== null) {
      const ctx = nextCanvas2.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, nextCanvas2.width, nextCanvas2.height);

        const tempPiece = createPiece(nextPiece2);
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
      }
    }
  }, [nextPiece, nextPiece2, createPiece, drawBlock]);

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
      const basePoints = [0, 100, 300, 500, 800][linesCleared];
      const newLevel = Math.floor(newLines / 10) + 1;

      // Multi-line bonus (for clearing 2+ lines at once)
      const multiLineBonus = [0, 0, 100, 300, 600][linesCleared];

      // Combo bonus: increase combo and give bonus points
      const newCombo = combo + 1;
      const comboBonus = newCombo > 1 ? 50 * newCombo : 0;

      // Total score = (base + multi-line bonus) * level + combo bonus * level
      const totalPoints = (basePoints + multiLineBonus) * level + comboBonus * level;

      setLines(newLines);
      setScore(prev => prev + totalPoints);
      setLevel(newLevel);
      setCombo(newCombo);
    } else {
      // Reset combo if no lines cleared
      setCombo(0);
    }

    return { board: newBoard, linesCleared };
  }, [lines, level, combo]);

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
    const { board: clearedBoard } = clearLines(mergedBoard);
    setBoard(clearedBoard);

    // Current piece becomes nextPiece
    const newPiece = createPiece(nextPiece!);

    // nextPiece becomes nextPiece2
    // nextPiece2 becomes a new random piece
    const newNextPiece2 = randomPiece();

    if (collides(newPiece)) {
      setGameOver(true);
    }

    setCurrentPiece(newPiece);
    setNextPiece(nextPiece2!);
    setNextPiece2(newNextPiece2);
  }, [collides, mergePiece, clearLines, randomPiece, createPiece, nextPiece, nextPiece2]);

  const newPiece = useCallback(() => {
    const pieceType = nextPiece ?? randomPiece();
    const piece = createPiece(pieceType);

    if (collides(piece)) {
      setGameOver(true);
    }

    setCurrentPiece(piece);
    // Shift pieces: nextPiece2 becomes nextPiece, generate new nextPiece2
    setNextPiece(nextPiece2 ?? randomPiece());
    setNextPiece2(randomPiece());
  }, [randomPiece, createPiece, nextPiece, nextPiece2, collides]);

  const restartGame = useCallback(() => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(0)));
    setScore(0);
    setLines(0);
    setLevel(1);
    setCombo(0);
    setGameOver(false);
    setIsPaused(false);
    setNextPiece(null);
    setNextPiece2(null);
    setCurrentPiece(null);
    setShowNicknamePrompt(false);
    setNickname("");
    setScoreSubmitted(false);
    pieceBagRef.current = [];

    setTimeout(() => {
      const pieceType = randomPiece();
      const nextType = randomPiece();
      const nextType2 = randomPiece();
      setCurrentPiece(createPiece(pieceType));
      setNextPiece(nextType);
      setNextPiece2(nextType2);
    }, 0);
  }, [randomPiece, createPiece]);

  const togglePause = useCallback(() => {
    if (!gameOver) {
      setIsPaused(prev => !prev);
    }
  }, [gameOver]);

  const submitScore = useCallback(async (playerNickname: string, silent: boolean = false) => {
    const apiUrl = typeof window !== 'undefined' ? window.ENV?.API_URL : '';
    if (!apiUrl) {
      console.error('API_URL is not configured');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/score/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_nickname: playerNickname,
          score_point: score,
          score_level: level,
          score_line: lines,
          score_combo: combo,
        }),
      });

      if (!response.ok && !silent) {
        console.error('Failed to submit score:', response.statusText);
      }
    } catch (error) {
      if (!silent) {
        console.error('Error submitting score:', error);
      }
    }
  }, [score, level, lines, combo]);

  const handleNicknameSubmit = useCallback(() => {
    // Prevent duplicate submissions
    if (scoreSubmitted) return;

    if (!nickname.trim()) {
      alert('Please enter a nickname');
      return;
    }

    // Submit score asynchronously (non-blocking)
    setScoreSubmitted(true);
    setShowNicknamePrompt(false);
    submitScore(nickname.trim(), false);
  }, [nickname, submitScore, scoreSubmitted]);

  const handleNicknameReject = useCallback(() => {
    // Prevent duplicate submissions
    if (scoreSubmitted) return;

    setShowNicknamePrompt(false);
    setScoreSubmitted(true);
    // Submit score asynchronously without user notice (backend generates random nickname)
    submitScore('', true);
  }, [submitScore, scoreSubmitted]);

  const fetchLeaderboard = useCallback(async () => {
    const apiUrl = typeof window !== 'undefined' ? window.ENV?.API_URL : '';
    if (!apiUrl) {
      console.error('API_URL is not configured');
      return;
    }

    setIsLoadingLeaderboard(true);
    try {
      const response = await fetch(`${apiUrl}/score/list`);
      if (response.ok) {
        const apiResponse = await response.json();
        // API returns { status, message, code, result } structure
        const data = apiResponse.result || apiResponse;
        setLeaderboardData(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch leaderboard:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, []);

  const toggleLeaderboard = useCallback(() => {
    if (!showLeaderboard) {
      fetchLeaderboard();
    }
    setShowLeaderboard(prev => !prev);
  }, [showLeaderboard, fetchLeaderboard]);

  useEffect(() => {
    newPiece();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gameOver && !showNicknamePrompt && !scoreSubmitted) {
      setShowNicknamePrompt(true);
    }
  }, [gameOver, showNicknamePrompt, scoreSubmitted]);

  useEffect(() => {
    drawNext();
  }, [nextPiece, nextPiece2, drawNext]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentPiece) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw board
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) {
          drawBlock(ctx, x, y, COLORS[board[y][x]]!);
        }
      }
    }

    // Draw ghost piece
    const ghostY = getGhostY(currentPiece);
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          const posX = (currentPiece.x + x) * BLOCK_SIZE;
          const posY = (ghostY + y) * BLOCK_SIZE;
          ctx.strokeStyle = currentPiece.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(posX, posY, BLOCK_SIZE, BLOCK_SIZE);
          ctx.fillStyle = currentPiece.color + '20';
          ctx.fillRect(posX, posY, BLOCK_SIZE, BLOCK_SIZE);
        }
      }
    }

    // Draw current piece
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          drawBlock(ctx, currentPiece.x + x, currentPiece.y + y, currentPiece.color);
        }
      }
    }
  }, [board, currentPiece, drawBlock, getGhostY]);

  useEffect(() => {
    if (gameOver || isPaused || !currentPiece) return;

    const dropInterval = Math.max(100, 1000 - (level - 1) * 100);

    const interval = setInterval(() => {
      if (!movePiece(0, 1)) {
        const mergedBoard = mergePiece(currentPieceRef.current!);
        const { board: clearedBoard } = clearLines(mergedBoard);
        setBoard(clearedBoard);

        // Current piece becomes nextPiece
        const newPiece = createPiece(nextPiece!);

        // nextPiece becomes nextPiece2
        // nextPiece2 becomes a new random piece
        const newNextPiece2 = randomPiece();

        if (collides(newPiece)) {
          setGameOver(true);
        }

        setCurrentPiece(newPiece);
        setNextPiece(nextPiece2!);
        setNextPiece2(newNextPiece2);
      }
    }, dropInterval);

    return () => clearInterval(interval);
  }, [level, gameOver, isPaused, currentPiece, movePiece, mergePiece, clearLines, randomPiece, createPiece, nextPiece, nextPiece2, collides]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;

      if (e.key === 'p' || e.key === 'P') {
        togglePause();
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
  }, [movePiece, rotatePiece, hardDrop, togglePause]);

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
          {gameOver && showNicknamePrompt && (
            <div className="game-over">
              <h1>GAME OVER</h1>
              <p>Score: <span>{score}</span></p>
              <div className="nickname-prompt">
                <p className="prompt-text">Save your score to the ranking?</p>
                <input
                  type="text"
                  placeholder="Enter your nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !scoreSubmitted) {
                      handleNicknameSubmit();
                    }
                  }}
                  maxLength={20}
                  autoFocus
                  disabled={scoreSubmitted}
                />
                <div className="prompt-buttons">
                  <button
                    onClick={handleNicknameSubmit}
                    disabled={scoreSubmitted}
                    className="save-button"
                  >
                    Save Score
                  </button>
                  <button
                    onClick={handleNicknameReject}
                    disabled={scoreSubmitted}
                    className="skip-button"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}
          {gameOver && !showNicknamePrompt && (
            <div className="game-over">
              <h1>GAME OVER</h1>
              <p>Score: <span>{score}</span></p>
              <button onClick={restartGame}>Play Again</button>
            </div>
          )}
          {showLeaderboard && (
            <div className="leaderboard-overlay">
              <div className="leaderboard-modal">
                <div className="leaderboard-header">
                  <h2>Ranking</h2>
                  <button className="close-button" onClick={toggleLeaderboard}>×</button>
                </div>
                <div className="leaderboard-content">
                  {isLoadingLeaderboard ? (
                    <p className="loading-text">Loading...</p>
                  ) : leaderboardData.length === 0 ? (
                    <p className="empty-text">No scores yet. Be the first!</p>
                  ) : (
                    <div className="leaderboard-list">
                      {leaderboardData.map((entry, index) => (
                        <div key={index} className={`leaderboard-entry ${index < 3 ? `rank-${index + 1}` : ''}`}>
                          <span className="rank">#{index + 1}</span>
                          <span className="player-name">{entry.user_nickname || 'Anonymous'}</span>
                          <span className="player-score">{entry.score_point?.toLocaleString() || 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
            <h2>Combo</h2>
            <p className={combo > 0 ? 'combo-active' : ''}>{combo > 0 ? `${combo}x` : '-'}</p>
          </div>
          <div className="info-box next-pieces-box">
            <h2>Next</h2>
            <div className="next-pieces-container">
              <canvas
                ref={nextCanvasRef}
                width={120}
                height={120}
                className="next-piece-canvas"
              />
              <canvas
                ref={nextCanvas2Ref}
                width={120}
                height={120}
                className="next-piece-canvas next-piece-2"
              />
            </div>
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
          <div className="button-group">
            <button className="leaderboard-button" onClick={toggleLeaderboard}>
              <span className="trophy-icon">🏆</span> Ranking
            </button>
            <button className="pause-button" onClick={togglePause}>
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button className="reset-button" onClick={restartGame}>
              Reset Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
