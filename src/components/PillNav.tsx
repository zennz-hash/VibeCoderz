import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import './PillNav.css';

const PillNav = ({
  logo,
  logoAlt = "Logo",
  items = [],
  activeHref = "/",
  className = "",
  ease = "power2.easeOut",
  baseColor = "#000000",
  pillColor = "#ffffff",
  hoveredPillTextColor = "#000000",
  pillTextColor = "#ffffff",
  theme = "light",
  initialLoadAnimation = false,
}: any) => {
  const [activeItem, setActiveItem] = useState(activeHref);
  const [hoveredItem, setHoveredItem] = useState(null);
  const containerRef = useRef(null);
  const pillRef = useRef(null);
  const itemsRef = useRef([]);
  const logoRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const activeIndex = items.findIndex((item: any) => item.href === activeItem);
    if (activeIndex !== -1 && itemsRef.current[activeIndex]) {
      const activeEl = itemsRef.current[activeIndex] as HTMLElement;
      gsap.to(pillRef.current, {
        x: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        duration: 0.5,
        ease,
      });
    }
  }, [activeItem, items, ease]);

  useEffect(() => {
    if (initialLoadAnimation) {
      gsap.from(containerRef.current, {
        y: -100,
        opacity: 0,
        duration: 1,
        ease: "elastic.out(1, 0.75)",
      });
    }
  }, [initialLoadAnimation]);

  // Re-calculate pill position on window resize
  useEffect(() => {
    const handleResize = () => {
      const activeIndex = items.findIndex((item: any) => item.href === activeItem);
      if (activeIndex !== -1 && itemsRef.current[activeIndex]) {
        const activeEl = itemsRef.current[activeIndex] as HTMLElement;
        gsap.set(pillRef.current, { x: activeEl.offsetLeft, width: activeEl.offsetWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeItem, items]);

  const handleMouseEnter = (href: any, index: any) => {
    setHoveredItem(href);
    const targetEl = itemsRef.current[index] as HTMLElement;
    if (targetEl) {
      gsap.to(pillRef.current, {
        x: targetEl.offsetLeft,
        width: targetEl.offsetWidth,
        duration: 0.4,
        ease,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    const activeIndex = items.findIndex((item: any) => item.href === activeItem);
    if (activeIndex !== -1 && itemsRef.current[activeIndex]) {
      const activeEl = itemsRef.current[activeIndex] as HTMLElement;
      gsap.to(pillRef.current, {
        x: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        duration: 0.4,
        ease,
      });
    }
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    const lines = (containerRef.current as any).querySelectorAll(".menu-line");
    const menu = (containerRef.current as any).querySelector(".pill-nav-mobile-menu");

    if (!isOpen) {
      gsap.to(lines[0], { rotation: 45, y: 3, duration: 0.3, ease });
      gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease });
      gsap.set(menu, { visibility: "visible" });
      gsap.fromTo(
        menu,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease }
      );
    } else {
      gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease });
      gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease });
      gsap.to(menu, {
        opacity: 0,
        y: 10,
        duration: 0.2,
        ease,
        onComplete: () => gsap.set(menu, { visibility: "hidden" }),
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`pill-nav-container w-full ${theme} ${className}`}
      style={{ "--base-color": baseColor, "--pill-color": pillColor } as React.CSSProperties}
    >
      <nav className="pill-nav">
        {logo && (
          <a href="/" className="pill-logo" ref={logoRef}>
            <img src={logo} alt={logoAlt} />
          </a>
        )}
        <div className="pill-nav-items" onMouseLeave={handleMouseLeave}>
          <div ref={pillRef} className="pill-active-bg" />
          {items.map((item: any, index: any) => (
            <a
              key={item.href}
              href={item.href}
              ref={(el) => { (itemsRef.current as any)[index] = el; }}
              className={`pill-item ${activeItem === item.href ? "active" : ""}`}
              onMouseEnter={() => handleMouseEnter(item.href, index)}
              onClick={(e) => {
                e.preventDefault();
                setActiveItem(item.href);
                if (item.href === '/') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  document.querySelector(item.href)?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              style={{
                color:
                  hoveredItem === item.href || activeItem === item.href
                    ? hoveredPillTextColor
                    : pillTextColor,
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
        <button className="pill-nav-toggle" onClick={toggleMenu}>
          <span className="menu-line" />
          <span className="menu-line" />
        </button>
      </nav>

      <div className="pill-nav-mobile-menu">
        {items.map((item: any) => (
          <a
            key={item.href}
            href={item.href}
            className="mobile-menu-item"
            onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                setActiveItem(item.href);
                if (item.href === '/') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  document.querySelector(item.href)?.scrollIntoView({ behavior: 'smooth' });
                }
            }}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
};

export default PillNav;
