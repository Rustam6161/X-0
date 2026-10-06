(() => {
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const MAX_MARKS = 3;
  const $ = (id) => document.getElementById(id);
  const boardEl = $("board"), statusEl = $("status");

  let mode = "pvp";
  let st; // состояние игры

  const tag = (p) => `<span class="${p.toLowerCase()}">${p}</span>`;
  const other = (p) => (p === "X" ? "O" : "X");

  function reset() {
    st = { board: Array(9).fill(null), q: { X: [], O: [] }, turn: "X", over: false, busy: false, token: (st?.token || 0) + 1 };
    render();
  }

  function findWin() {
    for (const p of ["X", "O"]) {
      const line = LINES.find((l) => l.every((i) => st.board[i] === p));
      if (line) return { player: p, line };
    }
    return null;
  }

  // Единое правило для всех режимов: 4-й символ удаляет самый старый символ этого игрока.
  function place(i) {
    const p = st.turn;
    st.board[i] = p;
    st.q[p].push(i);
    let removed = null;
    if (st.q[p].length > MAX_MARKS) {
      removed = st.q[p].shift();
      st.board[removed] = null;
    }
    const win = findWin();
    if (win) st.over = true;
    else if (st.board.every(Boolean)) st.over = true; // ничья (на практике недостижима)
    else st.turn = other(p);
    render({ placed: i, removed, win, owner: p });
    maybeComputer();
  }

  function render(fx = {}) {
    const win = fx.win || (st.over ? findWin() : null);
    boardEl.innerHTML = "";
    st.board.forEach((v, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cell";
      const isVanishing = fx.removed === i;
      const owner = isVanishing ? fx.owner : v;
      if (owner) {
        b.classList.add("filled", owner);
        b.innerHTML = `<span class="mark">${owner}</span>`;
      }
      if (isVanishing) b.classList.add("vanish");
      if (fx.placed === i) b.classList.add("new");
      // самый старый символ игрока, у которого уже 3 символа, исчезнет следующим
      if (v && !st.over && st.q[v].length === MAX_MARKS && st.q[v][0] === i && v === st.turn) b.classList.add("old");
      if (win && win.line.includes(i)) b.classList.add("win");
      b.disabled = st.over || st.busy || !!v || isComputerTurn();
      b.setAttribute("aria-label", `Клетка ${i + 1}${v ? ": " + v : ""}`);
      b.addEventListener("click", () => onCell(i));
      boardEl.appendChild(b);
    });
    statusEl.innerHTML = statusText(win);
  }

  function statusText(win) {
    if (win) {
      if (mode === "ai") return win.player === "X" ? `Вы победили! ${tag("X")} выиграли 🎉` : `Компьютер победил: ${tag("O")}`;
      return `Победили ${tag(win.player)}! 🎉`;
    }
    if (st.over) return "Ничья";
    if (mode === "ai") return st.turn === "X" ? `Ваш ход: ${tag("X")}` : `Компьютер думает… ${tag("O")}`;
    return `Ход игрока ${tag(st.turn)}`;
  }

  const isComputerTurn = () => mode === "ai" && st.turn === "O" && !st.over;

  function onCell(i) {
    if (st.over || st.busy || st.board[i] || isComputerTurn()) return;
    place(i);
  }

  async function maybeComputer() {
    if (!isComputerTurn()) return;
    st.busy = true;
    const token = st.token;
    try {
      const [res] = await Promise.all([
        fetch("/api/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: st.q.X, o: st.q.O, player: "O", difficulty: $("difficulty").value }),
        }),
        new Promise((r) => setTimeout(r, 650)),
      ]);
      const data = await res.json();
      if (token !== st.token) return; // игра была перезапущена
      if (!res.ok) throw new Error(data.error || "Ошибка");
      st.busy = false;
      place(data.cell);
    } catch (e) {
      if (token !== st.token) return;
      st.busy = false;
      render();
      statusEl.textContent = "Не удалось получить ход компьютера. Нажмите «Новая игра».";
    }
  }

  document.querySelectorAll(".seg").forEach((btn) =>
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      document.querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b === btn));
      $("levelBox").hidden = mode !== "ai";
      reset();
    })
  );
  $("difficulty").addEventListener("change", reset);
  $("newGame").addEventListener("click", reset);

  reset();
})();
