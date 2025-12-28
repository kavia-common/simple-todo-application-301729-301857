import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

/**
 * Small client around fetch for the todo backend.
 * Adjust BASE_URL if backend runs elsewhere.
 */
const BASE_URL = 'http://localhost:3001';

// PUBLIC_INTERFACE
export async function apiFetch(path, options = {}) {
  /** Helper for backend calls with proper headers and error handling. */
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed with status ${res.status}`);
  }
  // No content
  if (res.status === 204) return null;
  return res.json();
}

/**
 * UI components styled with App.css variables.
 */

// PUBLIC_INTERFACE
function Header({ theme, onToggleTheme }) {
  /** Header with brand title and theme toggle. */
  return (
    <header className="todo-header">
      <h1 className="brand">Tasks</h1>
      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
      </button>
    </header>
  );
}

// PUBLIC_INTERFACE
function NewTaskInput({ onAdd, disabled }) {
  /** Input bar to create a new task quickly (Enter to submit). */
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || busy || disabled) return;
    try {
      setBusy(true);
      await onAdd(trimmed);
      setTitle('');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      submit();
    }
  };

  return (
    <div className="new-task">
      <input
        className="input"
        type="text"
        placeholder="Add a new task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={busy || disabled}
        aria-label="New task title"
      />
      <button className="btn" onClick={submit} disabled={busy || disabled}>
        Add
      </button>
    </div>
  );
}

// PUBLIC_INTERFACE
function TodoItem({ item, onToggle, onDelete, onEdit }) {
  /** Single todo row with inline edit, toggle complete, and delete. */
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.title);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVal(item.title);
  }, [item.title]);

  const commit = async () => {
    const next = val.trim();
    if (next && next !== item.title) {
      setBusy(true);
      try {
        await onEdit(item.id, next);
      } finally {
        setBusy(false);
      }
    }
    setEditing(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      setVal(item.title);
      setEditing(false);
    }
  };

  return (
    <li className="todo-item">
      <label className="todo-left">
        <input
          type="checkbox"
          checked={!!item.completed}
          onChange={() => onToggle(item)}
          aria-label={`Mark ${item.title} as ${item.completed ? 'incomplete' : 'complete'}`}
        />
        {editing ? (
          <input
            className="edit-input"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            autoFocus
            disabled={busy}
            aria-label="Edit task title"
          />
        ) : (
          <span
            className={`title ${item.completed ? 'completed' : ''}`}
            onDoubleClick={() => setEditing(true)}
            title="Double click to edit"
          >
            {item.title}
          </span>
        )}
      </label>
      <div className="todo-actions">
        {!editing && (
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit task">
            ✏️
          </button>
        )}
        <button
          className="icon-btn danger"
          onClick={() => onDelete(item.id)}
          aria-label="Delete task"
        >
          🗑️
        </button>
      </div>
    </li>
  );
}

// PUBLIC_INTERFACE
function TodoList({ items, onToggle, onDelete, onEdit, loading }) {
  /** List of todo items with empty/loader state. */
  if (loading) {
    return <div className="status">Loading tasks…</div>;
  }
  if (!items.length) {
    return <div className="status">No tasks yet — add your first task!</div>;
  }
  return (
    <ul className="todo-list">
      {items.map((t) => (
        <TodoItem
          key={t.id}
          item={t}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </ul>
  );
}

// PUBLIC_INTERFACE
function App() {
  /** Main Todo app SPA with backend sync and themed UI. */
  const [theme, setTheme] = useState('light');
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  };

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr('');
        setLoading(true);
        const list = await apiFetch('/todos');
        if (mounted) setTodos(list || []);
      } catch (e) {
        if (mounted) setErr(e.message || 'Failed to load tasks');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const byId = useMemo(() => {
    const map = new Map();
    todos.forEach((t) => map.set(t.id, t));
    return map;
  }, [todos]);

  // CRUD handlers
  const addTask = async (title) => {
    setErr('');
    const created = await apiFetch('/todos', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    setTodos((prev) => [created, ...prev]);
  };

  const deleteTask = async (id) => {
    setErr('');
    await apiFetch(`/todos/${id}`, { method: 'DELETE' });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleTask = async (item) => {
    setErr('');
    // optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === item.id ? { ...t, completed: !t.completed } : t))
    );
    try {
      const updated = await apiFetch(`/todos/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !item.completed }),
      });
      // reconcile with server
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e) {
      // rollback on error
      setTodos((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, completed: item.completed } : t))
      );
      setErr(e.message || 'Failed to toggle task');
    }
  };

  const editTask = async (id, title) => {
    setErr('');
    const existing = byId.get(id);
    if (!existing) return;
    // optimistic
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    try {
      const updated = await apiFetch(`/todos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      // rollback
      setTodos((prev) => prev.map((t) => (t.id === id ? existing : t)));
      setErr(e.message || 'Failed to update task');
    }
  };

  return (
    <div className="App">
      <div className="page">
        <Header theme={theme} onToggleTheme={toggleTheme} />
        <main className="container">
          <div className="surface">
            <NewTaskInput onAdd={addTask} disabled={loading} />
            {err ? <div className="error" role="alert">{err}</div> : null}
            <TodoList
              items={todos}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onEdit={editTask}
              loading={loading}
            />
          </div>
        </main>
        <footer className="footer">
          <span>FastAPI @ :3001 • React @ :3000</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
