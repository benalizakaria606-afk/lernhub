import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const subjects = [
  ["Deutsch","📚"],["Mathematik","📐"],["Englisch","🇬🇧"],["Französisch","🇫🇷"],
  ["AES","🍎"],["Technik","⚙️"],["WBS","💼"],["Geschichte","🏛️"],
  ["Gemeinschaftskunde","⚖️"],["Biologie","🧬"],["Physik","⚡"],["Religion","🕊️"],
  ["Ethik","💭"],["Chemie","🧪"],["Geographie","🌍"],["Musik","🎵"]
];

const api = async (url, options={}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Etwas ist schiefgelaufen.");
  return data;
};

export default function App() {
  const [page,setPage] = useState("home");
  const [subject,setSubject] = useState("Mathematik");
  const [tab,setTab] = useState("Materialien");
  const [materials,setMaterials] = useState([]);
  const [allMaterials,setAllMaterials] = useState([]);
  const [messages,setMessages] = useState([]);
  const [query,setQuery] = useState("");
  const [dark,setDark] = useState(false);
  const [aiQuestion,setAiQuestion] = useState("");
  const [aiHistory,setAiHistory] = useState([]);
  const [aiBusy,setAiBusy] = useState(false);
  const [aiError,setAiError] = useState("");
  const [author,setAuthor] = useState(localStorage.getItem("lh-author") || "");
  const [chatInput,setChatInput] = useState("");
  const [materialTitle,setMaterialTitle] = useState("");
  const [materialBody,setMaterialBody] = useState("");
  const [materialKind,setMaterialKind] = useState("Aufschrieb");
  const [file,setFile] = useState(null);
  const [notice,setNotice] = useState("");
  const chatEnd = useRef(null);

  useEffect(() => {
    api("/api/materials").then(setAllMaterials).catch(()=>{});
    api("/api/messages").then(setMessages).catch(()=>{});
    const socket = io();
    socket.on("chat:new", msg => setMessages(old => old.some(m=>m.id===msg.id)?old:[...old,msg]));
    socket.on("material:new", item => setAllMaterials(old => old.some(m=>m.id===item.id)?old:[item,...old]));
    return () => socket.disconnect();
  },[]);
  useEffect(() => {
    if (page==="subject") api(`/api/materials?subject=${encodeURIComponent(subject)}`).then(setMaterials).catch(()=>setMaterials([]));
  },[page,subject]);
  useEffect(() => { chatEnd.current?.scrollIntoView({behavior:"smooth"}); },[messages,page]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; },[dark]);

  const filteredSubjects = subjects.filter(([name])=>name.toLowerCase().includes(query.toLowerCase()));
  const recent = allMaterials.slice(0,4);

  function openSubject(name) {
    setSubject(name); setTab("Materialien"); setAiHistory([]); setAiError(""); setPage("subject");
  }
  async function sendAI(e) {
    e?.preventDefault();
    if (!aiQuestion.trim() || aiBusy) return;
    const question = aiQuestion.trim();
    const history = aiHistory;
    setAiHistory(h=>[...h,{role:"user",content:question}]);
    setAiQuestion(""); setAiBusy(true); setAiError("");
    try {
      const context = materials.slice(0,12).map(m=>`Titel: ${m.title}\nArt: ${m.kind}\n${m.body}`).join("\n\n");
      const result = await api("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject,question,history,materialContext:context})});
      setAiHistory(h=>[...h,{role:"assistant",content:result.answer}]);
    } catch(err) { setAiError(err.message); }
    finally { setAiBusy(false); }
  }
  async function saveMaterial(e) {
    e.preventDefault();
    const title=materialTitle.trim();
    if(!title) return;
    const form=new FormData();
    form.append("subject",subject); form.append("title",title); form.append("body",materialBody); form.append("kind",materialKind);
    if(file) form.append("file",file);
    try {
      const item=await api("/api/materials",{method:"POST",body:form});
      setMaterials(old=>[item,...old]); setAllMaterials(old=>[item,...old]);
      setMaterialTitle("");setMaterialBody("");setFile(null);setNotice("Material wurde für alle gespeichert.");
      setTimeout(()=>setNotice(""),3500);
    } catch(err){setNotice(err.message);}
  }
  async function sendChat(e) {
    e.preventDefault();
    if(!chatInput.trim())return;
    const name=author.trim()||"Schüler/in";
    localStorage.setItem("lh-author",name);
    try { await api("/api/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({author:name,body:chatInput})}); setChatInput(""); }
    catch(err){setNotice(err.message);}
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">L</div><div><b>LernHub</b><small>Gemeinsam lernen</small></div></div>
      <nav>
        <button className={page==="home"?"nav active":"nav"} onClick={()=>setPage("home")}>⌂ <span>Startseite</span></button>
        <button className={page==="ai"?"nav active":"nav"} onClick={()=>{setPage("ai");setSubject("Allgemein");}}>✦ <span>KI-Agent</span></button>
        <button className={page==="chat"?"nav active":"nav"} onClick={()=>setPage("chat")}>▤ <span>Klassenchat</span><i className="nav-dot"/></button>
      </nav>
      <div className="side-label">DEINE FÄCHER</div>
      <div className="side-subjects">{subjects.map(([name,emoji])=><button key={name} onClick={()=>openSubject(name)} className={page==="subject"&&subject===name?"subject-link chosen":"subject-link"}><span>{emoji}</span>{name}</button>)}</div>
      <div className="sidebar-bottom"><button className="nav" onClick={()=>setDark(v=>!v)}>{dark?"☀":"☾"} <span>{dark?"Helles Design":"Dunkles Design"}</span></button><small>Ein gemeinsamer Lernort</small></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="mobile-brand"><div className="brand-mark">L</div><b>LernHub</b></div>
        <div className="breadcrumbs">LernHub <span>/</span> {page==="home"?"Startseite":page==="chat"?"Klassenchat":page==="ai"?"KI-Agent":subject}</div>
        <div className="top-actions"><button className="icon-btn" title="Design wechseln" onClick={()=>setDark(v=>!v)}>{dark?"☀":"☾"}</button><div className="avatar">10</div></div>
      </header>

      {page==="home"&&<div className="content">
        <section className="hero"><div className="hero-copy"><span className="eyebrow">DEIN DIGITALER LERNRAUM</span><h1>Willkommen bei <em>LernHub!</em></h1><p>Gemeinsam lernen. Einfach verstehen. Erfolgreich sein.</p><button className="primary" onClick={()=>setPage("ai")}>✦ KI-Lernassistent öffnen <span>→</span></button></div><div className="hero-art"><div className="orbit">✦</div><div className="book">📖</div><div className="spark s1">✧</div><div className="spark s2">✦</div></div></section>
        <div className="section-head"><div><h2>Deine Schulfächer</h2><p>Wähle ein Fach, um Materialien und KI-Hilfe zu entdecken.</p></div><span className="count">{subjects.length} Fächer</span></div>
        <div className="search-wrap"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Fach suchen …"/></div>
        <div className="subject-grid">{filteredSubjects.map(([name,emoji],i)=><button className="subject-card" key={name} onClick={()=>openSubject(name)}><div className={`subject-icon tone-${i%6}`}>{emoji}</div><div><b>{name}</b><small>{allMaterials.filter(m=>m.subject===name).length} Materialien</small></div><span className="arrow">↗</span></button>)}</div>
        <div className="section-head recent-head"><div><h2>Zuletzt hinzugefügt</h2><p>Neue Materialien aus eurer Lerngruppe.</p></div></div>
        {recent.length?<div className="recent-list">{recent.map(m=><button key={m.id} className="recent-item" onClick={()=>openSubject(m.subject)}><span className="file-icon">▤</span><span><b>{m.title}</b><small>{m.subject} · {m.kind}</small></span><span className="arrow">→</span></button>)}</div>:<div className="empty compact"><span>📄</span><b>Noch keine Materialien</b><small>Lade den ersten Aufschrieb hoch und teile ihn mit allen.</small></div>}
      </div>}

      {page==="subject"&&<div className="content">
        <button className="back-link" onClick={()=>setPage("home")}>← Alle Fächer</button>
        <section className="subject-hero"><div><span className="eyebrow">DEIN FACHBEREICH</span><h1>{subjects.find(s=>s[0]===subject)?.[1]} {subject}</h1><p>Alles für deinen Unterricht an einem Ort.</p></div><button className="primary" onClick={()=>setTab("KI-Agent")}>✦ {subject} AI fragen</button></section>
        <div className="tabs">{["Materialien","Zusammenfassungen","Übungen","KI-Agent","Hochladen"].map(t=><button key={t} className={tab===t?"tab active-tab":"tab"} onClick={()=>setTab(t)}>{t==="KI-Agent"?"✦ ":""}{t}</button>)}</div>
        {tab==="KI-Agent"?<AIChat subject={subject} history={aiHistory} setQuestion={setAiQuestion} question={aiQuestion} send={sendAI} busy={aiBusy} error={aiError} materials={materials}/>:tab==="Hochladen"?<div className="panel"><h2>Material teilen</h2><p className="muted">Dein Material wird gespeichert und ist für alle mit dem LernHub-Link sichtbar.</p><form className="material-form" onSubmit={saveMaterial}><label>Titel<input required value={materialTitle} onChange={e=>setMaterialTitle(e.target.value)} placeholder="z. B. Mitose – Zellteilung"/></label><label>Art<select value={materialKind} onChange={e=>setMaterialKind(e.target.value)}><option>Aufschrieb</option><option>Zusammenfassung</option><option>Übung</option><option>Arbeitsblatt</option></select></label><label>Notizen oder Text<textarea value={materialBody} onChange={e=>setMaterialBody(e.target.value)} placeholder="Hier kannst du den Inhalt einfügen …" rows="5"/></label><label className="upload-box">＋ Datei hinzufügen (PDF, PNG oder JPG)<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setFile(e.target.files?.[0]||null)}/>{file&&<small>Ausgewählt: {file.name}</small>}</label><button className="primary">Material für alle speichern →</button>{notice&&<p className="notice">{notice}</p>}</form></div>:<><div className="materials-head"><div><h2>{tab==="Materialien"?"Unterrichtsmaterialien":tab}</h2><p className="muted">{tab==="Materialien"?"Aufschriebe und Arbeitsblätter aus eurer Klasse.":"Lerninhalte zum Wiederholen und Üben."}</p></div><button className="primary small" onClick={()=>setTab("Hochladen")}>＋ Hinzufügen</button></div><div className="material-list">{materials.filter(m=>tab==="Materialien"||m.kind.toLowerCase().includes(tab==="Zusammenfassungen"?"zusammen":"übung")).map(m=><article className="material-card" key={m.id}><div className="file-icon">▤</div><div className="material-main"><b>{m.title}</b><small>{m.kind} · {new Date(m.created_at).toLocaleDateString("de-DE")}</small>{m.body&&<p>{m.body}</p>}{m.file_url&&<a href={m.file_url} target="_blank" rel="noreferrer">Datei öffnen ↗</a>}</div><button className="outline-btn" onClick={()=>{setTab("KI-Agent");setAiQuestion(`Erkläre mir bitte diesen Aufschrieb: ${m.title}\n${m.body}`);}}>✦ Erklären</button></article>)}{!materials.length&&<div className="empty"><span>📚</span><b>Hier ist noch nichts vorhanden</b><small>Teile den ersten Aufschrieb mit deiner Klasse.</small><button className="outline-btn" onClick={()=>setTab("Hochladen")}>Material hinzufügen</button></div>}</div></>}
      </div>}

      {page==="ai"&&<div className="content"><div className="page-intro"><span className="eyebrow">DEIN DIGITALER LERNPARTNER</span><h1>Frag die <em>LernHub AI.</em></h1><p>Stelle Fragen, lade Aufgaben hoch und lass dir Themen Schritt für Schritt erklären.</p></div><AIChat subject="Allgemein" history={aiHistory} setQuestion={setAiQuestion} question={aiQuestion} send={sendAI} busy={aiBusy} error={aiError} materials={allMaterials}/></div>}

      {page==="chat"&&<div className="content chat-page"><div className="page-intro"><span className="eyebrow">EURE KLASSENGEMEINSCHAFT</span><h1>Klassen<span className="blue">chat.</span></h1><p>Fragen stellen, Ideen teilen und gemeinsam lernen.</p></div><div className="chat-panel"><div className="chat-panel-head"><div className="group-avatar">👥</div><div><b>Klasse 10 – Gruppe</b><small>{messages.length} Nachrichten geladen · gemeinsamer Chat</small></div><span className="live-dot">● Live</span></div><div className="chat-messages">{messages.map(m=><div className="chat-message" key={m.id}><div className="mini-avatar">{m.author.slice(0,1).toUpperCase()}</div><div className="bubble-wrap"><div className="bubble-name">{m.author}</div><div className="bubble">{m.body}</div><time>{new Date(m.created_at+"Z").toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</time></div></div>)}{!messages.length&&<div className="empty"><span>💬</span><b>Der Chat ist noch leer</b><small>Schreib die erste Nachricht in eure Klassengruppe.</small></div>}<div ref={chatEnd}/></div><form className="chat-compose" onSubmit={sendChat}><input className="name-input" value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Dein Name" maxLength="32" aria-label="Dein Name"/><input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Nachricht an die Klasse …" maxLength="1500"/><button className="send-btn" aria-label="Senden">➤</button></form><p className="chat-warning">Hinweis: Ohne Anmeldung kann jeder mit dem Link Nachrichten unter einem frei gewählten Namen senden.</p></div></div>}
      <footer>© LernHub · Gemeinsam lernen, einfacher verstehen.</footer>
    </main>
    <nav className="mobile-nav"><button onClick={()=>setPage("home")}>⌂<small>Start</small></button><button onClick={()=>{setPage("ai");setSubject("Allgemein");}}>✦<small>KI-Agent</small></button><button onClick={()=>setPage("chat")}>▤<small>Chat</small></button></nav>
  </div>;
}

function AIChat({subject,history,setQuestion,question,send,busy,error,materials}) {
  return <div className="ai-panel"><div className="ai-panel-head"><div className="ai-avatar">✦</div><div><b>{subject==="Allgemein"?"LernHub AI":`${subject} AI`}</b><small>Schulassistent · Klasse 10</small></div><span className="live-dot">● Bereit</span></div><div className="ai-conversation">{!history.length?<div className="ai-welcome"><div className="ai-big">✦</div><h2>Wobei kann ich dir helfen?</h2><p>Ich erkläre dir Themen einfach und Schritt für Schritt. Du kannst auch eine konkrete Aufgabe beschreiben.</p><div className="suggestions"><button onClick={()=>setQuestion("Erkläre mir das aktuelle Thema Schritt für Schritt.")}>Thema einfach erklären</button><button onClick={()=>setQuestion("Erstelle mir eine kurze Zusammenfassung zum aktuellen Thema.")}>Zusammenfassung erstellen</button><button onClick={()=>setQuestion("Gib mir 5 Übungsaufgaben mit Lösungen.")}>Übungsaufgaben erstellen</button></div></div>:history.map((m,i)=><div className={`ai-msg ${m.role}`} key={i}><div className="ai-msg-icon">{m.role==="assistant"?"✦":"Du"}</div><div className="ai-msg-text">{m.content}</div></div>)}{busy&&<div className="ai-msg assistant"><div className="ai-msg-icon">✦</div><div className="typing">LernHub AI denkt nach …</div></div>}{error&&<div className="error-msg">{error}</div>}</div><form className="ai-compose" onSubmit={send}><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder={`Frage zu ${subject==="Allgemein"?"deinem Schulstoff":subject+" stellen"} …`} rows="2"/><div className="compose-bottom"><small>KI kann Fehler machen. Prüfe wichtige Lösungen.</small><button className="send-btn" disabled={busy||!question.trim()}>➤</button></div></form><div className="context-note">✦ {materials.length?`${materials.length} Lernmaterialien können als Kontext genutzt werden.`:"Lade Unterrichtsmaterialien hoch, damit die KI sie berücksichtigen kann."}</div></div>;
}
