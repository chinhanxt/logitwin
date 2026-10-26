import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  IconArrowRight,
  IconArrowsExchange,
  IconBell,
  IconBook2,
  IconBox,
  IconCheck,
  IconChevronRight,
  IconCircleCheck,
  IconCube,
  IconHistory,
  IconLayersIntersect,
  IconLayoutDashboard,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
  IconTruck,
  IconX,
} from "@tabler/icons-react";
import { api, kindName, money, statusName, storeName } from "./api";
import type { Overview, Explanation, Session } from "./api";
import type { Decision, Role } from "../core/contracts";
import Dashboard from "./Dashboard";
import Inventory from "./Inventory";
import DecisionDrawer from "./DecisionDrawer";
import Architecture from "./Architecture";
import Knowledge from "./Knowledge";
import Assistant from "./Assistant";
import Routing from "./Routing";
import ColdChain from "./ColdChain";
import { useLiveUpdates } from "./useLiveUpdates";
const OperationalTwin = lazy(() => import("./twin/OperationalTwin"));
type Page = "overview" | "decisions" | "inventory" | "knowledge" | "audit" | "architecture" | "assistant" | "routing" | "coldchain" | "twin";
const pages: { id: Page; label: string; icon: typeof IconBox }[] = [
  { id: "twin", label: "Vận hành 3D", icon: IconCube },
  { id: "overview", label: "Tổng quan", icon: IconLayoutDashboard },
  { id: "decisions", label: "Quyết định", icon: IconSparkles },
  { id: "assistant", label: "Trợ lý Intelligence", icon: IconSparkles },
  { id: "coldchain", label: "Giám sát chuỗi lạnh", icon: IconShieldCheck },
  { id: "routing", label: "Lộ trình giao hàng", icon: IconTruck },
  { id: "inventory", label: "Hàng hóa & điều chuyển", icon: IconBox },
  { id: "knowledge", label: "Tri thức vận hành", icon: IconBook2 },
  { id: "audit", label: "Nhật ký workflow", icon: IconHistory },
  { id: "architecture", label: "Kiến trúc 7 lớp", icon: IconLayersIntersect },
];
const roleNames = { planner: "Người lập", approver: "Người phê duyệt", viewer: "Chỉ xem" };
export default function App() {
  const [authMode, setAuthMode] = useState("loading");
  const [page, setPage] = useState<Page>("twin"),
    [session, setSession] = useState<Session | null>(null),
    [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Decision | null>(null),
    [explanation, setExplanation] = useState<Explanation | null>(null),
    [filter, setFilter] = useState("all");
  const refresh = useCallback(async () => {
    const next = await api<Overview>("/overview");
    setData(next);
    setSelected((old) => (old ? next.decisions.find((d) => d.id === old.id) || null : null));
  }, []);
  const expireSession = useCallback(() => {
    setSession(null);
    setData(null);
    setSelected(null);
    setError("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
  }, []);
  const liveStatus = useLiveUpdates(session?.id, refresh, expireSession);
  async function changeRole(role: Role) {
    setBusy(true);
    setError("");
    try {
      setSession(await api<Session>("/session", "POST", { role }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void api<{ mode: string }>("/auth/config")
      .then((c) => setAuthMode(c.mode))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let cancelled = false;
    api<Session>("/session")
      .then((s) => {
        if (!cancelled) {
          setSession(s);
          void refresh().catch((e) => setError(e.message));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!selected) {
      setExplanation(null);
      return;
    }
    let active = true;
    setExplanation(null);
    api<Explanation>(`/decisions/${selected.id}/explain`)
      .then((d) => {
        if (active) setExplanation(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selected?.id]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  async function act(path: string, message: string, payload?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, "POST", payload);
      await refresh();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = data?.decisions.filter((d) => d.status === "pending").length || 0;
  const visible = data?.decisions.filter((d) => filter === "all" || d.status === filter) || [];
  function decisionCards(limit?: number) {
    const items = (limit ? data?.decisions.slice(0, limit) : visible) || [];
    return items.length ? (
      <div className="decision-list">
        {items.map((d) => {
          const s = data?.stocks.find((s) => s.id === d.payload.source);
          return (
            <button className="decision-card" key={d.id} onClick={() => setSelected(d)}>
              <div className={`decision-icon ${d.kind}`}>
                <IconArrowsExchange size={21} />
              </div>
              <div className="decision-info">
                <div>
                  <span className="decision-kind">{kindName[d.kind]}</span>
                  <span className={`badge ${d.status}`}>{statusName[d.status]}</span>
                </div>
                <h3>{s?.name}</h3>
                <p>
                  {storeName(s?.store || "")} {d.payload.target ? `→ ${storeName(d.payload.target.split("-")[0])}` : "· Cần xử lý"}
                </p>
              </div>
              <div className="decision-amount">
                <b>{d.kind === "markdown" ? `${money(d.payload.unitPrice || 0)}₫` : `${d.payload.quantity} ${s?.unit || ""}`}</b>
                <IconChevronRight size={17} />
              </div>
            </button>
          );
        })}
      </div>
    ) : (
      <div className="empty">
        <IconSparkles size={30} />
        <h3>{filter === "all" ? "Sẵn sàng cho quyết định đầu tiên" : "Không có đề xuất ở trạng thái này"}</h3>
        <p>Người lập chọn “Phân tích dữ liệu” để tạo đề xuất từ tồn kho.</p>
      </div>
    );
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <span className="brand-mark">
            <IconCube size={25} />
          </span>
          <div>
            DX<span> / </span>OS<small>LOGISTICS INTELLIGENCE</small>
          </div>
        </a>
        <div className="workspace">
          <span className="workspace-icon">L</span>
          <div>
            Không gian Logistics<small>Chuỗi cửa hàng mẫu</small>
          </div>
          <IconChevronRight size={14} />
        </div>
        <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          {pages.map((p) => (
            <button key={p.id} className={page === p.id ? "active" : ""} onClick={() => setPage(p.id)}>
              <p.icon size={19} />
              <span>{p.label}</span>
              {p.id === "decisions" && pending > 0 && <b>{pending}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="core-status">
            <span className="live-dot" />
            <div>
              Lõi số headless<small>{data ? "API đã kết nối" : "Chờ kết nối phiên"}</small>
            </div>
          </div>
          <button className="architecture-link" onClick={() => setPage("architecture")}>
            <IconShieldCheck size={18} /> Bản phát triển · Đối chiếu đề thi <IconArrowRight size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Không gian HPDI <IconChevronRight size={13} /> <b>Intelligence</b>
          </div>
          <div className="topbar-right">
            <span className="demo-tag">DỮ LIỆU MẪU</span>
            <button
              aria-label="Xem đề xuất chờ duyệt"
              className="icon-button"
              onClick={() => {
                setPage("decisions");
                setFilter("pending");
              }}
            >
              <IconBell size={20} />
              {pending > 0 && <i />}
            </button>
            <div className="avatar">LN</div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">LOGISTICS / INTELLIGENCE</div>
              <h1>{page === "overview" ? "Mỗi quyết định, đúng thời điểm." : pages.find((p) => p.id === page)?.label}</h1>
              <p>
                {page === "overview"
                  ? "Kết nối tồn kho, nhu cầu và hành động trên một không gian."
                  : "Dữ liệu và thao tác được xử lý qua lõi số headless."}
              </p>
            </div>
            <button
              className="button primary"
              disabled={!session || session.role !== "planner" || busy}
              onClick={() => void act("/analysis", "Đã phân tích tồn kho. Các đề xuất đang chờ người phê duyệt.")}
            >
              <IconSparkles size={18} />
              {busy ? "Đang xử lý…" : "Phân tích dữ liệu"}
            </button>
          </div>
          <div className="session-bar">
            <span>
              <IconShieldCheck size={17} /> {authMode === "oidc" ? "Định danh Keycloak" : "Phiên demo cục bộ"}{" "}
              <span className="muted">· {authMode === "oidc" ? "OIDC · phân quyền theo tài khoản" : "chưa phải SSO"}</span>
            </span>
            {authMode === "oidc" ? (
              <span>
                {session ? roleNames[session.role] : "Chưa đăng nhập"}{" "}
                {session ? (
                  <button
                    className="button secondary"
                    onClick={async () => {
                      await api("/auth/logout", "POST");
                      setSession(null);
                      setData(null);
                      setSelected(null);
                    }}
                  >
                    Đăng xuất cổng
                  </button>
                ) : (
                  <a className="button secondary" href="/api/auth/login">
                    Đăng nhập SSO
                  </a>
                )}
              </span>
            ) : (
              <label>
                Vai trò{" "}
                <select
                  aria-label="Vai trò demo"
                  value={session?.role || ""}
                  disabled={busy}
                  onChange={(e) => void changeRole(e.target.value as Role)}
                >
                  {!session && <option value="">Chọn để bắt đầu</option>}
                  {Object.entries(roleNames).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Đóng lỗi">
                <IconX size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              <IconCheck size={17} />
              {notice}
            </div>
          )}
          {!session && page !== "architecture" ? (
            <section className="welcome panel">
              <div className="welcome-icon">
                <IconSparkles size={40} />
              </div>
              <span className="eyebrow">TỪ DỮ LIỆU ĐẾN HÀNH ĐỘNG</span>
              <h2>Bắt đầu một luồng Logistics</h2>
              <p>Đăng nhập phiên mẫu để phân tích 3 cửa hàng, tạo đề xuất và kiểm chứng workflow có phê duyệt.</p>
              {authMode === "oidc" ? (
                <a className="button primary" href="/api/auth/login">
                  Đăng nhập qua Keycloak <IconArrowRight size={18} />
                </a>
              ) : (
                <button className="button primary" disabled={busy || authMode === "loading"} onClick={() => void changeRole("planner")}>
                  Bắt đầu với vai trò Người lập <IconArrowRight size={18} />
                </button>
              )}
              <small>
                {authMode === "oidc"
                  ? "Đăng nhập tài khoản được cấp. Quyền và chuỗi cửa hàng lấy từ danh tính đã xác thực."
                  : "Chọn vai trò chỉ phục vụ demo trên máy này. Chưa kết nối nhà cung cấp định danh."}
              </small>
            </section>
          ) : (
            <>
              {page === "architecture" && <Architecture />}
              {page === "twin" && session && data && (
                <Suspense fallback={<section className="panel empty">Đang tải không gian vận hành 3D…</section>}>
                  <OperationalTwin data={data} role={session.role} busy={busy} onDecision={setSelected} onAction={act} />
                </Suspense>
              )}
              {data && page === "overview" && <Dashboard data={data} cards={decisionCards(3)} onDecisions={() => setPage("decisions")} />}
              {data && page === "decisions" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Trung tâm quyết định</h2>
                      <p>Mở đề xuất để xem số liệu, giả định và các bước cần duyệt.</p>
                    </div>
                    <select aria-label="Lọc trạng thái" value={filter} onChange={(e) => setFilter(e.target.value)}>
                      <option value="all">Tất cả trạng thái</option>
                      {Object.entries(statusName).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  {decisionCards()}
                </section>
              )}
              {data && session && page === "inventory" && <Inventory data={data} role={session.role} busy={busy} act={act} />}
              {page === "assistant" && session && <Assistant role={session.role} report={setNotice} />}
              {page === "routing" && session && <Routing />}
              {page === "coldchain" && session && data && <ColdChain data={data} role={session.role} onRefresh={refresh} />}
              {page === "knowledge" && session && <Knowledge role={session.role} report={setNotice} />}
              {data && page === "audit" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Dấu vết thực thi</h2>
                      <p>Ghi cùng giao dịch nghiệp vụ · tối đa 100 sự kiện gần nhất</p>
                    </div>
                    <button className="button secondary" disabled={busy} onClick={() => void refresh().catch((e) => setError(e.message))}>
                      <IconRefresh size={16} />
                      Làm mới
                    </button>
                  </div>
                  <div className="notice">Chuỗi hash hỗ trợ đối chiếu nhật ký cục bộ; chưa phải sổ cái bất biến hoặc bằng chứng chống chối bỏ.</div>
                  {!data.events.length && <p className="empty">Chưa có sự kiện. Bắt đầu bằng một lượt phân tích.</p>}
                  {data.events.map((e) => (
                    <article className="audit-event" key={e.seq}>
                      <span className="audit-dot">
                        <IconCircleCheck size={17} />
                      </span>
                      <div>
                        <strong>{e.type}</strong>
                        <p>
                          {e.actor} · {e.entity.slice(0, 12)}
                        </p>
                        <code>SHA-256 {e.hash.slice(0, 24)}…</code>
                      </div>
                      <time>{new Date(e.created_at).toLocaleTimeString("vi-VN")}</time>
                    </article>
                  ))}
                </section>
              )}
            </>
          )}
          <footer>
            <span>
              <span className="live-dot" />{" "}
              {data
                ? `Đồng bộ ${new Date(data.now).toLocaleTimeString("vi-VN")} · ${liveStatus === "live" ? "realtime" : "đang nối lại"}`
                : "Chưa có phiên dữ liệu"}
            </span>
            <span>DX-OS Open-Core · Bản phát triển Logistics</span>
          </footer>
        </main>
      </div>
      {selected && session && (
        <DecisionDrawer selected={selected} explanation={explanation} role={session.role} busy={busy} onClose={() => setSelected(null)} act={act} />
      )}
    </div>
  );
}
