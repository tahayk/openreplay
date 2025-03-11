/* Auto-generated, do not edit */
import React from 'react';

interface Props {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  fill?: string;
}

function Lightbulb(props: Props) {
    const { size = 14, width = size, height = size, fill = '' } = props;
    return (
      <svg viewBox="0 0 384 512" width={ `${ width }px` } height={ `${ height }px` } ><path d="M192 80c0 8.837-7.164 16-16 16-35.29 0-64 28.71-64 64 0 8.837-7.164 16-16 16s-16-7.163-16-16c0-52.935 43.065-96 96-96 8.836 0 16 7.163 16 16zm176 96c0 101.731-51.697 91.541-90.516 192.674a23.722 23.722 0 0 1-5.484 8.369V464h-.018a23.99 23.99 0 0 1-5.241 14.574l-19.535 24.419A24 24 0 0 1 228.465 512h-72.93a24 24 0 0 1-18.741-9.007l-19.535-24.419A23.983 23.983 0 0 1 112.018 464H112v-86.997a24.153 24.153 0 0 1-5.54-8.478c-38.977-101.401-90.897-90.757-90.457-193.822C16.415 78.01 95.306 0 192 0c97.195 0 176 78.803 176 176zM240 448h-96v12.775L159.38 480h65.24L240 460.775V448zm0-64h-96v32h96v-32zm96-208c0-79.59-64.424-144-144-144-79.59 0-144 64.423-144 144 0 87.475 44.144 70.908 86.347 176h115.306C291.779 247.101 336 263.222 336 176z"/></svg>
  );
}

export default Lightbulb;
