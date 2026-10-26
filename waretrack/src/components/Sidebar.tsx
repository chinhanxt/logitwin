import { IconHelp, IconLayoutDashboard, IconPackage, IconTruck } from "@tabler/icons-react";
import { useWarehouse } from "../data/store";
import { sites } from "../data/seed";
import type { Drawer } from "./types";
export default function Sidebar({
  drawer,
  openDrawer,
  openHelp,
}: {
  drawer: Drawer;
  openDrawer: (mode: Drawer) => void;
  openHelp: () => void;
}) {
  const s = useWarehouse();
  return (
    <nav className="sidebar" aria-label="Điều hướng chính">
      <div className="nav-top">
        <button
          className={!drawer ? "nav-item active" : "nav-item"}
          aria-label="Tổng quan 3D"
          title="Tổng quan 3D"
          onClick={() => openDrawer(null)}
        >
          <IconLayoutDashboard size={23} />
        </button>
        <button
          className={drawer === "shipments" ? "nav-item active" : "nav-item"}
          aria-label="Lô hàng"
          title="Lô hàng"
          onClick={() => openDrawer("shipments")}
        >
          <IconTruck size={23} />
        </button>
        <button
          className={drawer === "inventory" ? "nav-item active" : "nav-item"}
          aria-label="Tồn kho"
          title="Tồn kho"
          onClick={() => openDrawer("inventory")}
        >
          <IconPackage size={23} />
        </button>
        <div className="nav-separator" />
        <span className="nav-caption">KHO</span>
        {sites.map((site, index) => (
          <button
            key={site.id}
            className={`site-nav ${s.siteId === site.id ? "active" : ""}`}
            aria-label={`Chuyển đến ${site.name}`}
            title={site.name}
            onClick={() => s.setSite(site.id)}
          >
            {String(index + 1).padStart(2, "0")}
          </button>
        ))}
      </div>
      <button className="nav-item" aria-label="Hướng dẫn sử dụng" title="Hướng dẫn" onClick={openHelp}>
        <IconHelp size={23} />
      </button>
    </nav>
  );
}
