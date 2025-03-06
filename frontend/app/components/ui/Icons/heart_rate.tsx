/* Auto-generated, do not edit */
import React from 'react';

interface Props {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  fill?: string;
}

function Heart_rate(props: Props) {
  const { size = 14, width = size, height = size, fill = '' } = props;
  return (
    <svg viewBox="0 0 640 512" width={`${width}px`} height={`${height}px`}>
      <path d="M480 224c-6.53 0-12.44 3.98-14.84 10.06l-45.62 114.05-84-335.98C333.72 4.86 327.69.17 319.62 0c-7.5.19-13.84 5.53-15.31 12.86l-82.06 410.23-46.72-186.97A16.005 16.005 0 0 0 160 224H8c-4.42 0-8 3.58-8 8v16c0 4.42 3.58 8 8 8h139.5l60.97 243.88c1.78 7.14 8.22 12.12 15.53 12.12h.38c7.5-.19 13.84-5.53 15.31-12.86l82.06-410.23 78.72 314.97c1.69 6.73 7.53 11.62 14.44 12.09 7.62.28 13.38-3.59 15.94-10.03l60-149.94H632c4.42 0 8-3.58 8-8v-16c0-4.42-3.58-8-8-8H480z" />
    </svg>
  );
}

export default Heart_rate;
