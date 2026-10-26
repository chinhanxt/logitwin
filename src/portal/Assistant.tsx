import { useState } from "react";
import { IconArrowUp, IconBook2, IconCheck, IconDatabase, IconSparkles } from "@tabler/icons-react";
import { api } from "./api";
import type { Role } from "../core/contracts";
interface Answer {
  mode: string;
  answer: string;
  model: string | null;
  numericCheck: string;
  sources: { id: string; title: string; text: string; version: number; score: number }[];
}
export default function Assistant({ role, report }: { role: Role; report: (message: string) => void }) {
  const [question, setQuestion] = useState("Quy trình điều chuyển và nhận hàng cần kiểm tra những gì?"),
    [answer, setAnswer] = useState<Answer | null>(null),
    [busy, setBusy] = useState(false),
    [indexing, setIndexing] = useState(false),
    [error, setError] = useState("");
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setAnswer(await api<Answer>("/agent/ask", "POST", { question }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function index() {
    setIndexing(true);
    setError("");
    try {
      const result = await api<{ indexed: number; model: string }>("/knowledge/index", "POST");
      report(`Đã lập chỉ mục ${result.indexed} đoạn mới bằng ${result.model}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIndexing(false);
    }
  }
  const sections = answer
    ? [
        ["Đề xuất", answer.answer],
        [
          "Lý do",
          answer.sources.length
            ? `Đối chiếu ${answer.sources.length} đoạn tài liệu nội bộ có nguồn và phiên bản bên dưới.`
            : "Chưa có nguồn nội bộ được lập chỉ mục.",
        ],
        [
          "Độ tin cậy",
          answer.mode === "local-llm"
            ? "Mô hình cục bộ đã trả lời; kiểm tra chữ số không phát hiện token số ngoài các nguồn được trích. Chưa đánh giá độ chính xác ngữ nghĩa."
            : answer.mode === "source-excerpt"
              ? "Trả đoạn nguồn trực tiếp vì mô hình chưa qua kiểm tra."
              : "Chưa đủ bằng chứng để trả lời.",
        ],
        [
          "Giả định",
          "Tài liệu nội bộ còn hiệu lực và người dùng kiểm tra nguồn trước khi áp dụng. Nội dung do người dùng nhập chưa được chứng nhận.",
        ],
        ["Việc cần duyệt", "Trợ lý chỉ giải thích. Mọi thay đổi tồn kho hoặc giá vẫn đi qua đề xuất và người phê duyệt có quyền."],
      ]
    : [];
  return (
    <section className="panel assistant-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">[I] INTELLIGENCE</span>
          <h2>Trợ lý vận hành tiếng Việt</h2>
          <p>Truy hồi ngữ nghĩa từ tài liệu của chuỗi · mô hình chạy cục bộ</p>
        </div>
        <button className="button secondary" disabled={role !== "planner" || indexing || busy} onClick={() => void index()}>
          <IconDatabase size={16} />
          {indexing ? "Đang lập chỉ mục…" : "Lập chỉ mục AI"}
        </button>
      </div>
      <div className="assistant-body">
        {!answer && (
          <div className="assistant-intro">
            <span className="sparkle-square">
              <IconSparkles size={22} />
            </span>
            <div>
              <h3>Tra cứu trước khi hành động</h3>
              <p>Thêm SOP ở tab Tri thức vận hành, lập chỉ mục AI rồi đặt câu hỏi. Trợ lý trả lời theo 5 mục và kèm đoạn nguồn.</p>
            </div>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {answer && (
          <>
            <div className="agent-status">
              <IconCheck size={15} />
              {answer.mode === "local-llm"
                ? `${answer.model} · đã kiểm tra token số`
                : answer.mode === "source-excerpt"
                  ? "Trả đoạn nguồn · chưa dùng kết quả LLM"
                  : "Chưa đủ bằng chứng"}
            </div>
            {sections.map(([title, body], i) => (
              <article className="explanation" key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </article>
            ))}
            {answer.sources.length > 0 && (
              <div className="source-list">
                <h3>
                  <IconBook2 size={16} />
                  Nguồn truy hồi
                </h3>
                {answer.sources.map((s, i) => (
                  <details key={`${s.id}-${i}`}>
                    <summary>
                      {s.title} · v{s.version}
                    </summary>
                    <p>{s.text}</p>
                    <small>
                      ID {s.id} · độ tương đồng {s.score.toFixed(3)} (không phải độ tin cậy)
                    </small>
                  </details>
                ))}
              </div>
            )}
          </>
        )}
        <form className="ask-form" onSubmit={ask}>
          <label htmlFor="agent-question">Câu hỏi về quy trình nội bộ</label>
          <div>
            <textarea
              id="agent-question"
              minLength={5}
              maxLength={500}
              rows={2}
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Điều chuyển hàng tươi cần kiểm tra điều gì?"
            />
            <button className="button primary" disabled={busy || indexing} aria-label="Gửi câu hỏi">
              <IconArrowUp size={20} />
            </button>
          </div>
          <small>{busy ? "Đang truy hồi và đối chiếu câu trả lời…" : "Không gửi dữ liệu đến mô hình cloud. Không tự thực thi nghiệp vụ."}</small>
        </form>
      </div>
    </section>
  );
}
