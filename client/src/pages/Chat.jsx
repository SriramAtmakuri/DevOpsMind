import { useState, useEffect, useRef } from 'react';
import { Send, Loader, Terminal, Plus, Trash2, MessageSquare } from 'lucide-react';
import api from '../api/axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Chat.css';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const loadConversation = async (conv) => {
    setConversationId(conv.id);
    try {
      const res = await api.get(`/chat/conversations/${conv.id}/messages`);
      setMessages(res.data.map(m => ({ role: m.role, content: m.content })));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  const deleteConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/conversations/${convId}`);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (conversationId === convId) {
        startNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/chat/chat', {
        message: userMessage.content,
        conversationId,
      });

      const newConvId = response.data.conversationId;
      if (!conversationId) {
        setConversationId(newConvId);
        await fetchConversations();
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.message,
        toolsUsed: response.data.toolsUsed || [],
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: ' + (error.response?.data?.error || 'Failed to get response'),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const examplePrompts = [
    'Check production server health',
    'List all running containers',
    'Show deployment history',
    'Analyze server performance',
  ];

  return (
    <div className="chat-page" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{
          width: '260px', flexShrink: 0, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)',
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
            <button className="btn-primary" onClick={startNewConversation} style={{ width: '100%' }}>
              <Plus size={16} />
              New Chat
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {conversations.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.75rem', textAlign: 'center' }}>
                No conversations yet
              </p>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                    background: conversationId === conv.id ? 'var(--bg-tertiary)' : 'transparent',
                    marginBottom: '0.25rem',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (conversationId !== conv.id) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { if (conversationId !== conv.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <MessageSquare size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                    <span style={{
                      fontSize: '0.8rem', color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {conv.title || 'Untitled'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(e, conv.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem',
                      color: 'var(--text-muted)', flexShrink: 0, borderRadius: '4px',
                      display: 'flex', alignItems: 'center',
                    }}
                    title="Delete conversation"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="chat-header">
          <div className="header-content">
            <button
              onClick={() => setSidebarOpen(p => !p)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
              title="Toggle sidebar"
            >
              ☰
            </button>
            <Terminal size={24} />
            <div>
              <h1>AI Chat Assistant</h1>
              <p>Ask me anything about your infrastructure</p>
            </div>
          </div>
        </div>

        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto' }}>
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <Terminal size={48} />
              <h2>Welcome to DevOpsMind AI</h2>
              <p>I can help you manage servers, containers, deployments, and more.</p>
              <div className="example-prompts">
                <p className="example-title">Try asking:</p>
                {examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    className="example-prompt"
                    onClick={() => setInput(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="message-avatar">
                    {message.role === 'user' ? 'U' : 'AI'}
                  </div>
                  <div className="message-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                    {message.toolsUsed && message.toolsUsed.length > 0 && (
                      <div className="tools-used">
                        <p>Tools executed:</p>
                        {message.toolsUsed.map((tool, i) => (
                          <span key={i} className="tool-badge">
                            {tool.toolName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="message assistant">
                  <div className="message-avatar">AI</div>
                  <div className="message-content">
                    <Loader className="spin" size={20} />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your infrastructure..."
            className="chat-input"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} className="send-btn">
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;
