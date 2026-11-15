export function CareIllustration({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? 'care-illustration small' : 'care-illustration'}
      viewBox="0 0 520 420"
      role="img"
      aria-label="An older woman enjoying a peaceful moment with her family"
    >
      <defs>
        <linearGradient id="arch" x2="0" y2="1">
          <stop stopColor="#a6cbb2" />
          <stop offset="1" stopColor="#e0ead0" />
        </linearGradient>
      </defs>
      <path d="M64 386V195C64 29 390 17 411 195v191Z" fill="url(#arch)" />
      <circle cx="331" cy="96" r="40" fill="#fff2cd" />
      <path
        d="M29 381c34-25 70-29 111-16M387 379c30-35 65-55 111-49"
        stroke="#316f57"
        strokeWidth="4"
        fill="none"
      />
      <g fill="#417d61">
        <ellipse cx="58" cy="348" rx="13" ry="33" transform="rotate(-40 58 348)" />
        <ellipse cx="91" cy="346" rx="12" ry="28" transform="rotate(30 91 346)" />
        <ellipse cx="438" cy="328" rx="13" ry="35" transform="rotate(35 438 328)" />
        <ellipse cx="466" cy="350" rx="13" ry="29" transform="rotate(62 466 350)" />
      </g>
      <rect x="104" y="308" width="303" height="28" rx="12" fill="#b87e53" />
      <path d="M120 333v65m265-65v65" stroke="#b87e53" strokeWidth="15" />
      <path d="M148 316c-22-101 6-132 54-132 44 0 65 43 58 132" fill="#f4a184" />
      <path
        d="M178 314c-12 27-19 54-20 81m62-81c11 26 21 51 22 81"
        stroke="#6d765a"
        strokeWidth="30"
        strokeLinecap="round"
      />
      <path d="M179 190v-31h44v33" fill="#bd805e" />
      <ellipse cx="200" cy="132" rx="45" ry="55" fill="#d89970" />
      <path d="M155 127c-5-57 81-80 92-15-26-2-48-18-52-26-9 23-25 34-40 41Z" fill="#e8e3d6" />
      <circle cx="237" cy="86" r="22" fill="#e8e3d6" />
      <path d="M182 134h11m20 0h11" stroke="#484d3d" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M192 155q13 12 25-1"
        stroke="#97553e"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="204" cy="123" r="3" fill="#a54f47" />
      <path
        d="M162 222c-8 43 8 55 57 45m23-44c11 26 24 39 49 44"
        stroke="#d89970"
        strokeWidth="23"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M283 314c-19-108 9-143 52-142 52 1 70 46 60 142" fill="#2c7568" />
      <path
        d="M303 313l-9 80m65-80 18 80"
        stroke="#56616c"
        strokeWidth="31"
        strokeLinecap="round"
      />
      <path d="M315 180v-34h38v37" fill="#af775c" />
      <ellipse cx="334" cy="122" rx="40" ry="50" fill="#ca9272" />
      <path
        d="M293 121c-8-47 22-67 50-58 40-1 48 44 26 64l-10-34c-26 12-43 9-56 7Z"
        fill="#344c44"
      />
      <path d="M319 125h8m16 0h8" stroke="#344c44" strokeWidth="3" strokeLinecap="round" />
      <path d="M324 145q10 8 20-2" stroke="#995e48" strokeWidth="3" fill="none" />
      <path
        d="M303 207c-16 23-19 52-39 57m108-53c21 28 12 58-13 63"
        stroke="#ca9272"
        strokeWidth="22"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M219 254l46 7-6 29-47-9Z" fill="#fff8ed" />
      <path d="m218 263 37 8m-38 0 30 7" stroke="#8cad95" strokeWidth="2" />
      <path d="M45 402h430" stroke="#729b7f" strokeWidth="3" strokeLinecap="round" />
      <g fill="#fbf7e9">
        <path d="m75 160 7 13 15 3-15 4-7 14-5-14-14-4 14-3Z" />
        <path d="m432 217 5 10 11 3-11 3-5 10-4-10-10-3 10-3Z" />
      </g>
    </svg>
  );
}
