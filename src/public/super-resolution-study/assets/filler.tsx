import React, { useEffect, useState } from 'react';

interface ViewerParams {
  websiteLink: string;
  pairNumber: number;
}

// Define a more specific type for answers instead of using 'any'
// type AnswerRecord = Record<string, string | number | boolean>;
// interface Props {
//   parameters: ViewerParams;
//   setAnswer: (args: { status: boolean; answers: AnswerRecord }) => void;
// }

interface Props {
  parameters: ViewerParams;
}

function ImageViewer({ parameters }: Props) {
  const { websiteLink, pairNumber } = parameters;
  const [iframeHeight, setIframeHeight] = useState('65vh');

  // useEffect(() => {
  //   console.log('Window width:', window.innerWidth);
  //   console.log('Window height:', window.innerHeight);
  //   console.log('Screen width:', window.screen.width);
  //   console.log('Screen height:', window.screen.height);
  // }, []);

  useEffect(() => {
    const updateHeight = () => {
      const windowHeight = window.innerHeight;
      const height = Math.floor(windowHeight * 0.60);
      setIframeHeight(`${height}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* Make the iframe occupy the full viewport */}
      <iframe
        src={websiteLink}
        className="flex-1"
        style={{
          display: 'flex',
          width: '100%',
          height: iframeHeight,
          minWidth: '100%',
          border: 'none',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          marginBottom: '10px',
        }}
        scrolling="no"
        allowFullScreen
      />
      {/* Overlay the pair number at the bottom */}
      <div
        className="text"
        style={{
          width: '100%',
          padding: '8px 0',
          textAlign: 'center',
          fontSize: '1.5rem',
          fontWeight: 500,
          color: 'black',
          marginBottom: '10px',
        }}
      >
        Image Pair
        {' '}
        {pairNumber}
      </div>
    </div>
  );
}

export default ImageViewer;
