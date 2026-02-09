"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const GRID_SIZE = 20;
const CELL_SIZE = 14;
const MOVE_MS = 180;

type Dir = "up" | "down" | "left" | "right";

function randomCell(): { x: number; y: number } {
  return {
    x: Math.floor(Math.random() * GRID_SIZE),
    y: Math.floor(Math.random() * GRID_SIZE),
  };
}

function spawnFood(snake: { x: number; y: number }[]): { x: number; y: number } {
  let f = randomCell();
  while (snake.some((s) => s.x === f.x && s.y === f.y)) {
    f = randomCell();
  }
  return f;
}

const INITIAL_SNAKE: { x: number; y: number }[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

export default function SnakeGame() {
  const [snake, setSnake] = useState<{ x: number; y: number }[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<{ x: number; y: number }>(() => spawnFood(INITIAL_SNAKE));
  const [direction, setDirection] = useState<Dir>("right");
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);
  const directionRef = useRef(direction);
  const foodRef = useRef(food);

  gameOverRef.current = gameOver;
  directionRef.current = direction;
  foodRef.current = food;

  const reset = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood(spawnFood(INITIAL_SNAKE));
    setDirection("right");
    setGameOver(false);
  }, []);

  useEffect(() => {
    const keyToDir: Record<string, Dir> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      W: "up",
      s: "down",
      S: "down",
      a: "left",
      A: "left",
      d: "right",
      D: "right",
    };
    const opposites: Record<Dir, Dir> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameOverRef.current) {
        if (e.key === "r" || e.key === "R") reset();
        return;
      }
      const next = keyToDir[e.key];
      if (next && opposites[directionRef.current] !== next) setDirection(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reset]);

  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      const dir = directionRef.current;
      const currentFood = foodRef.current;
      setSnake((prev) => {
        const head = prev[0];
        let nextHead: { x: number; y: number };
        switch (dir) {
          case "up":
            nextHead = { x: head.x, y: head.y - 1 };
            break;
          case "down":
            nextHead = { x: head.x, y: head.y + 1 };
            break;
          case "left":
            nextHead = { x: head.x - 1, y: head.y };
            break;
          default:
            nextHead = { x: head.x + 1, y: head.y };
        }
        if (
          nextHead.x < 0 ||
          nextHead.x >= GRID_SIZE ||
          nextHead.y < 0 ||
          nextHead.y >= GRID_SIZE
        ) {
          gameOverRef.current = true;
          setGameOver(true);
          return prev;
        }
        if (prev.some((s) => s.x === nextHead.x && s.y === nextHead.y)) {
          gameOverRef.current = true;
          setGameOver(true);
          return prev;
        }
        const ate = nextHead.x === currentFood.x && nextHead.y === currentFood.y;
        const bodyAfterMove = ate ? prev : prev.slice(0, -1);
        const nextSnake = [nextHead, ...bodyAfterMove];
        if (ate) setFood(spawnFood(nextSnake));
        return nextSnake;
      });
    }, MOVE_MS);
    return () => clearInterval(id);
  }, [gameOver]);

  const size = GRID_SIZE * CELL_SIZE;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="whitespace-nowrap text-center text-xs text-slate-600 sm:text-sm">
        Use arrow keys or WASD to move. Press R to restart.
      </p>
      <div
        className="grid border-2 border-slate-300 bg-slate-100"
        style={{
          width: size,
          height: size,
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
        }}
      >
        {snake.map((s, i) => (
          <div
            key={`s-${i}`}
            className="bg-green-600"
            style={{
              gridColumn: s.x + 1,
              gridRow: s.y + 1,
            }}
          />
        ))}
        <div
          className="bg-red-500"
          style={{
            gridColumn: food.x + 1,
            gridRow: food.y + 1,
          }}
        />
      </div>
      <p className="whitespace-nowrap text-center text-xs text-slate-600 sm:text-sm">
        Eat the red square. Don&apos;t hit the walls or yourself.
      </p>
      {gameOver && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-slate-700">
            Game over – press R to restart
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-600"
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
