import { useEffect, useState } from "react";
import { api } from "./api";
import type { Document, Role } from "../core/contracts";
export default function Knowledge({ role, report }: { role: Role; report: (message: string) => void }) {
  const [query, setQuery] = useState(""),
    [docs, setDocs] = useState<Document[]>([]),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false);
  async function load(q: string) {
    try {
      const d = await api<{ documents: Document[] }>(`/documents?q=${encodeURIComponent(q)}`);
      setDocs(d.documents);
    } catch (e) {
      report((e as Error).message);
    }
  }
  useEffect(() => {
    void load("");
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/documents", "POST", { title, body });
      setTitle("");
      setBody("");
      await load(query);
      report("Đã lưu tài liệu và ghi nguồn gốc trong nhật ký.");
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="knowledge-grid">
      <section className="panel">
        <div className="panel-heading">
          <h2>Tri thức vận hành</h2>
          <span className="tag">Tìm theo từ khóa</span>
        </div>
        <form
          className="search-row"
          onSubmit={(e) => {
            e.preventDefault();
            void load(query);
          }}
        >
          <input aria-label="Tìm tài liệu" placeholder="Tìm SOP, quy trình nhận hàng…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="button secondary">Tìm kiếm</button>
        </form>
        {docs.map((d) => (
          <article className="document" key={d.id}>
            <span className="eyebrow">NỘI BỘ · PHIÊN BẢN {d.version}</span>
            <h3>{d.title}</h3>
            <p>{d.body}</p>
            <small>
              Nguồn: {d.id.slice(0, 8)} · {new Date(d.created_at).toLocaleString("vi-VN")}
            </small>
          </article>
        ))}
        {!docs.length && <p className="empty">Không có tài liệu khớp từ khóa.</p>}
      </section>
      <form className="panel document-form" onSubmit={save}>
        <h2>Thêm tài liệu nội bộ</h2>
        <p>Lưu văn bản và metadata theo chuỗi cửa hàng. Chưa bật tải tệp nhị phân hoặc semantic RAG.</p>
        <label>
          Tiêu đề
          <input
            minLength={3}
            maxLength={120}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Kiểm tra hàng trước khi giao"
          />
        </label>
        <label>
          Nội dung
          <textarea minLength={20} maxLength={20000} required rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <button className="button primary" disabled={busy || role !== "planner"}>
          {busy ? "Đang lưu…" : "Lưu tài liệu"}
        </button>
        {role !== "planner" && <small>Chuyển sang vai trò Người lập để thêm tài liệu.</small>}
      </form>
    </div>
  );
}
