import type { CSSProperties, ReactNode } from "react";
import "./Section.css";

export function Section({ title, subtitle, actions, children, id }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" id={id}>
      {(title || actions) && (
        <div className="section__head">
          <div>
            {title && <h2 className="section__title">{title}</h2>}
            {subtitle && <p className="section__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="section__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className = "", onClick, id, style }: { children: ReactNode; className?: string; onClick?: () => void; id?: string; style?: CSSProperties }) {
  return (
    <div className={`card ${className}`} onClick={onClick} role={onClick ? "button" : undefined} id={id} style={style}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
