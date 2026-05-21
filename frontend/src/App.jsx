import React, { useState } from 'react'
import ASDgif from './assets/200w.gif'

const App = () => {
  const [Kuy,SetKuy] = useState ("")

  const ClickMe = () => {
    SetKuy("olo")
  }
  
  return (
    <div>
      <h1>ikuymon nahee</h1>
      <h1>ikuyP nahee Too</h1>
      <h2>IkuyBoat mai yom ma talk with friend pai kin teenoi</h2>
      <img src={ASDgif} alt="" />

      <h1>{Kuy}</h1>
      <button onClick={ClickMe} className="px-8 py-4 text-lg">ลองกดดู</button>
    </div>
  )
}

export default App
