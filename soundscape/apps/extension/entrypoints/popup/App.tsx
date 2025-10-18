import React from 'react';

const App: React.FC = () => {
  return (
    <div className='p-4 w-80 bg-background text-foreground'>
      <h1 className='text-lg font-semibold text-red-400'>
        Soundscape Extension
      </h1>
      <p className='mt-2 text-sm text-muted-foreground'>
        Extension infrastructure ready
      </p>
    </div>
  );
};

export default App;
