export function ProfileAvatar({
  username,
  avatarUrl,
  className = "w-11 h-11"
}: {
  username?: string;
  avatarUrl?: string;
  className?: string;
}) {
  return (
    <div
      className={`${className} relative rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-[#b8ccb8] shadow-sm select-none transition-transform hover:scale-105 bg-[#e2ede3]`}
      title={username || 'Profile'}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username || 'Profile'}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        /* Illustrated Student Profile Portrait matching the reference design */
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Background Soft Cream / Sage */}
          <rect width="48" height="48" fill="#E4EDE4" />
          <circle cx="24" cy="22" r="18" fill="#D3E5D5" />

          {/* Shoulders & Green Top */}
          <path
            d="M10 46C10 37 16 32 24 32C32 32 38 37 38 46"
            fill="#1E472D"
          />
          <path
            d="M18 46V35C20 37 28 37 30 35V46"
            fill="#2A5C3C"
          />

          {/* Neck & Chin */}
          <path
            d="M20 28H28V33C28 35.2 26.2 37 24 37C21.8 37 20 35.2 20 33V28Z"
            fill="#EAC4A4"
          />

          {/* Hair - Back Layer */}
          <path
            d="M14 20C14 13 18 10 24 10C30 10 34 13 34 20C34 26 33 30 32 32H16C15 30 14 26 14 20Z"
            fill="#1D2A22"
          />

          {/* Face */}
          <ellipse cx="24" cy="23" rx="7.5" ry="9" fill="#F7D7BC" />

          {/* Hair - Front Bangs & Bob Style */}
          <path
            d="M15 19C16 13 20 11 24 11C28 11 32 13 33 19C31 16 27 15 24 16C20 17 17 17 15 19Z"
            fill="#23342B"
          />
          <path
            d="M14 20C14 24 15 28 16 30C16.8 28 17 24 17 21C16 21 14.8 20.6 14 20Z"
            fill="#23342B"
          />
          <path
            d="M34 20C34 24 33 28 32 30C31.2 28 31 24 31 21C32 21 33.2 20.6 34 20Z"
            fill="#23342B"
          />

          {/* Eyes */}
          <circle cx="21" cy="23" r="1" fill="#1C3825" />
          <circle cx="27" cy="23" r="1" fill="#1C3825" />

          {/* Gentle Smile */}
          <path
            d="M22.5 27C23.2 27.8 24.8 27.8 25.5 27"
            stroke="#1C3825"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Online Status Indicator Dot */}
      <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#2d7a46] border-2 border-white shadow-xs" />
    </div>
  );
}
