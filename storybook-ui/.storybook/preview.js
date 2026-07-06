import React from 'react';
import '../src/components/styles.css';

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f8f9fb' },
        { name: 'dark', value: '#1a1d23' },
      ],
    },
  },
};

export default preview;