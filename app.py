"""Крестики-нолики с «исчезающими» символами: Flask-сервер + ИИ."""
import random
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

LINES = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]
MAX_MARKS = 3
PRIORITY = [4, 0, 2, 6, 8, 1, 3, 5, 7]  # центр, углы, стороны


def other(p):
    return "O" if p == "X" else "X"


def apply_move(queues, player, cell):
    """Ставит символ; при 4-м символе удаляет самый старый. Возвращает новые очереди."""
    new = {"X": list(queues["X"]), "O": list(queues["O"])}
    new[player].append(cell)
    if len(new[player]) > MAX_MARKS:
        new[player].pop(0)
    return new


def has_won(queues, player):
    marks = set(queues[player])
    return any(all(c in marks for c in line) for line in LINES)


def empty_cells(queues):
    busy = set(queues["X"]) | set(queues["O"])
    return [c for c in PRIORITY if c not in busy]


def negamax(queues, player, depth, alpha, beta):
    """Оценка позиции для игрока, который ходит. Глубина ограничена: игра может быть бесконечной."""
    best = -10**6
    for cell in empty_cells(queues):
        nxt = apply_move(queues, player, cell)
        if has_won(nxt, player):
            score = 100 + depth
        elif depth <= 1:
            score = 0
        else:
            score = -negamax(nxt, other(player), depth - 1, -beta, -alpha)
        best = max(best, score)
        alpha = max(alpha, score)
        if alpha >= beta:
            break
    return best


def move_easy(queues, player):
    return random.choice(empty_cells(queues))


def move_medium(queues, player):
    cells = empty_cells(queues)
    opp = other(player)
    # 1. выиграть сразу
    for c in cells:
        if has_won(apply_move(queues, player, c), player):
            return c
    # 2. заблокировать немедленный выигрыш соперника
    for c in cells:
        if has_won(apply_move(queues, opp, c), opp):
            return c
    # 3. ход, после которого соперник не выигрывает сразу; центр > углы > стороны
    for c in cells:
        nxt = apply_move(queues, player, c)
        if not any(has_won(apply_move(nxt, opp, o), opp) for o in empty_cells(nxt)):
            return c
    return cells[0]


def move_hard(queues, player, depth=9):
    cells = empty_cells(queues)
    opp = other(player)
    scores = {}
    for c in cells:
        nxt = apply_move(queues, player, c)
        if has_won(nxt, player):
            scores[c] = 10**5
        else:
            scores[c] = -negamax(nxt, opp, depth - 1, -10**6, 10**6)
    top = max(scores.values())
    return random.choice([c for c, s in scores.items() if s == top])


AI = {"easy": move_easy, "medium": move_medium, "hard": move_hard}


def valid_queue(q):
    return isinstance(q, list) and len(q) <= MAX_MARKS and all(isinstance(i, int) and 0 <= i < 9 for i in q)


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/move")
def api_move():
    data = request.get_json(silent=True) or {}
    queues = {"X": data.get("x", []), "O": data.get("o", [])}
    player = data.get("player", "O")
    level = data.get("difficulty", "medium")
    if player not in ("X", "O") or level not in AI or not (valid_queue(queues["X"]) and valid_queue(queues["O"])):
        return jsonify(error="Некорректные данные"), 400
    if len(set(queues["X"]) | set(queues["O"])) != len(queues["X"]) + len(queues["O"]):
        return jsonify(error="Некорректная позиция"), 400
    if not empty_cells(queues):
        return jsonify(error="Нет свободных клеток"), 400
    return jsonify(cell=AI[level](queues, player))


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
