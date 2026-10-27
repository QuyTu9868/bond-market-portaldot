"use client"; // Chạy ở trình duyệt

const STEPS = [ // Bốn bước giải thích cách chốt kết quả
  { title: "Bet", text: "Pick Yes or No and put money in before the deadline. Winners share the whole bet pool." },
  { title: "Bond", text: "After the deadline anyone can post a bond on Yes or No. The first bond opens a resolution window." },
  { title: "Outbid", text: "During the window anyone can add more bond to either side. A late bond extends the window." },
  { title: "Settle", text: "The side with the larger total bond wins and shares the losing bonds. Ties are refunded." },
];

export default function HowItWorks() { // Khối giải thích ngắn cho người mới, có thể thu gọn
  return ( // Bốn thẻ nằm ngang, xuống dòng trên điện thoại
    <details className="how" open>
      <summary>How it works</summary>
      <div className="steps">
        {STEPS.map((step, index) => <div key={step.title} className="step"><span className="num">{index + 1}</span><b>{step.title}</b><p>{step.text}</p></div>)}
      </div>
      <p className="muted">No oracle and no admin: the contract never checks what really happened, it relies on incentives. Pushing a wrong result means out-bonding everyone who disagrees.</p>
    </details>
  );
}
