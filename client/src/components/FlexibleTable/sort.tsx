const SortIcon = ({ primaryColor = 'currentColor', secondaryColor = 'currentColor' }) => {
    return (
        <svg
            width="6"
            height="12"
            viewBox="0 0 6 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                className="sort__first_tone"
                d="M3 0L5.59808 3.75H0.401924L3 0Z"
                fill={primaryColor}
            />
            <path
                className="sort__second_tone"
                d="M3 12L0.401924 8.25L5.59808 8.25L3 12Z"
                fill={secondaryColor}
            />
        </svg>
    );
};

export default SortIcon;
