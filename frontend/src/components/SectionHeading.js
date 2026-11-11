export default function SectionHeading({ eyebrow, title, description, className = "" }) {
    return (
        <div className={`section-heading ${className}`}>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="display-title">{title}</h1>
            {description && <p className="section-description">{description}</p>}
        </div>
    );
}
