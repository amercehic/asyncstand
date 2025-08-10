import React from 'react';

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

const defaultLinks: SkipLink[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
  { href: '#footer', label: 'Skip to footer' },
];

export function SkipLinks({ links = defaultLinks }: SkipLinksProps) {
  return (
    <div className="skip-links">
      {links.map(link => (
        <a
          key={link.href}
          href={link.href}
          className="skip-link"
          onFocus={e => {
            e.currentTarget.classList.add('skip-link-visible');
          }}
          onBlur={e => {
            e.currentTarget.classList.remove('skip-link-visible');
          }}
        >
          {link.label}
        </a>
      ))}
      <style>{`
        .skip-links {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 9999;
        }
        
        .skip-link {
          position: absolute;
          left: -10000px;
          top: auto;
          width: 1px;
          height: 1px;
          overflow: hidden;
          background: #000;
          color: #fff;
          padding: 8px 16px;
          text-decoration: none;
          font-weight: bold;
          border-radius: 0 0 4px 0;
          transition: all 0.2s ease;
        }
        
        .skip-link:focus,
        .skip-link-visible {
          position: absolute;
          left: 0;
          top: 0;
          width: auto;
          height: auto;
          overflow: visible;
        }
        
        .skip-link:hover,
        .skip-link:focus {
          background: #333;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
