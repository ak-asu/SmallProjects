import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Eye, RotateCcw, Ruler } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

type GenAIType = GoogleGenerativeAI;
type AIProvider = 'gemini' | 'claude';

const GEMINI_MODEL = 'gemini-2.5-flash';
const ANALYZE_FULL_FILE = false;

const App = () => {
  // Load cached state from localStorage
  const loadCachedState = () => {
    try {
      const cached = localStorage.getItem('projectstory-state');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading cached state:', error);
    }
    return null;
  };

  const cachedState = loadCachedState();

  // Reset fileUploaded if we're in initial view (prevents blank screen on reload)
  const shouldResetUpload = cachedState?.view === 'initial' && cachedState?.fileUploaded;

  const [view, setView] = useState(cachedState?.view || 'initial'); // 'initial' or 'cycle'
  const [fileUploaded, setFileUploaded] = useState(shouldResetUpload ? false : (cachedState?.fileUploaded || false));
  const [bubbles, setBubbles] = useState<Array<{ id: number, icon: React.ElementType, label: string, color: string, options: string[], angle: number, popped: boolean, isAnimating: boolean }>>([]);
  const [optionBubbles, setOptionBubbles] = useState<Array<{ id: string, label: string, categoryId: number, categoryLabel: string, color: string, angle: number, popped: boolean, isAnimating: boolean }>>([]);
  const [splitting, setSplitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [activeStage, setActiveStage] = useState(cachedState?.activeStage || 0);
  const [isRotating, setIsRotating] = useState(false);
  const [selections, setSelections] = useState<{ Genre?: string, Audience?: string, Length?: string }>(cachedState?.selections || {});
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [provider, setProvider] = useState<AIProvider>(cachedState?.provider || 'gemini');
  const [apiKey, setApiKey] = useState(cachedState?.apiKey || '');
  const [claudeKey, setClaudeKey] = useState(cachedState?.claudeKey || '');
  const [showApiInput, setShowApiInput] = useState(!(cachedState?.apiKey || cachedState?.claudeKey));
  const [stages, setStages] = useState<Array<{ name: string, description: string, color: string, weight: number }>>(cachedState?.stages || []);
  const [stageContents, setStageContents] = useState<Record<string, string>>(cachedState?.stageContents || {});
  const [vectorStore, setVectorStore] = useState<Array<{ chunk: string, embedding: number[], index: number }>>(cachedState?.vectorStore || []);
  const [analysis, setAnalysis] = useState(cachedState?.analysis || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Persist background blob data so they don't re-randomize on every render
  const bgBlobsRef = useRef<Array<{ width: number, height: number, left: number, top: number, duration: number, delay: number, floatX: number, floatY: number }>>([]);
  if (bgBlobsRef.current.length === 0) {
    const blobs = [];
    for (let i = 0; i < 20; i++) {
      const w = Math.random() * 300 + 50;
      const h = Math.random() * 300 + 50;
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const duration = Math.random() * 20 + 10;
      const delay = Math.random() * 5;
      const floatX = Math.random() * 100 - 50;
      const floatY = Math.random() * 100 - 50;
      blobs.push({ width: w, height: h, left, top, duration, delay, floatX, floatY });
    }
    bgBlobsRef.current = blobs;
  }
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [clickRipples, setClickRipples] = useState<Array<{ id: number, x: number, y: number, size: number }>>([]);

  const bubbleActions = [
    {
      icon: FileText,
      label: 'Genre',
      color: 'from-purple-400 to-pink-400',
      options: ['Struggle', 'Horror', 'Mystical', 'Fantasy', 'Adventure', 'Romance']
    },
    {
      icon: Eye,
      label: 'Audience',
      color: 'from-blue-400 to-cyan-400',
      options: ['Professional', 'Kid', 'Teenager', 'General', 'Academic']
    },
    {
      icon: Ruler,
      label: 'Length',
      color: 'from-green-400 to-emerald-400',
      options: ['Short', 'Medium', 'Long']
    }
  ];

  // Save state to localStorage whenever relevant state changes
  useEffect(() => {
    const stateToCache = {
      view,
      fileUploaded,
      activeStage,
      selections,
      provider,
      apiKey,
      claudeKey,
      stages,
      stageContents,
      vectorStore
    };

    try {
      localStorage.setItem('projectstory-state', JSON.stringify(stateToCache));
    } catch (error) {
      console.error('Error caching state:', error);
    }
  }, [view, fileUploaded, activeStage, selections, provider, apiKey, claudeKey, stages, stageContents, vectorStore]);

  // Agent 1: File Analysis and Vector Embeddings
  const analyzeFileAndCreateEmbeddings = async (fileContent: string, genAI?: GenAIType, claude?: Anthropic) => {
    setProcessingStage('Analyzing file and creating embeddings...');

    // Conditionally split content based on ANALYZE_FULL_FILE flag
    let chunks = [];
    if (ANALYZE_FULL_FILE) {
      // Split content into chunks for detailed analysis
      const chunkSize = 2000;
      for (let i = 0; i < fileContent.length; i += chunkSize) {
        chunks.push(fileContent.slice(i, i + chunkSize));
      }
    } else {
      // Send entire file as one chunk (single API call)
      chunks = [fileContent];
    }

    // Analyze file type and content (single API call with full content)
    const analysisPrompt = `Analyze this document content and provide:
1. Document type/domain (e.g., software project, business plan, research paper, etc.)
2. Key topics and themes
3. Main objectives or purpose
4. Industry/field classification

Full content:
${fileContent}`;

    let analysis = '';

    if (provider === 'gemini' && genAI) {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const analysisResult = await model.generateContent(analysisPrompt);
      analysis = analysisResult.response.text();

      // Create embeddings for chunks using Gemini
      const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const embeddings = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embeddingResult = await embeddingModel.embedContent(chunks[i]);
          embeddings.push({
            chunk: chunks[i],
            embedding: embeddingResult.embedding.values,
            index: i
          });
        } catch (error) {
          console.error(`Error creating embedding for chunk ${i}:`, error);
        }
      }
      setVectorStore(embeddings);
    } else if (provider === 'claude' && claude) {
      const message = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: analysisPrompt
        }]
      });

      const content = message.content[0];
      analysis = content.type === 'text' ? content.text : '';

      // For Claude, create simple embeddings (mock/fallback since Claude doesn't have native embeddings)
      // In production, you'd use a separate embedding service or Gemini embeddings
      const embeddings = chunks.map((chunk, i) => ({
        chunk,
        embedding: Array(768).fill(0).map(() => Math.random()), // Mock embedding
        index: i
      }));
      setVectorStore(embeddings);
    }

    setAnalysis(analysis);
  };

  // Agent 2: Create Stage Plan
  // Determine word limit based on user Length selection
  const wordLimit = selections.Length === 'Short' ? 50 : selections.Length === 'Long' ? 120 : 80;

  // Helper: choose a Tailwind font-size class based on content length vs word limit
  const getFontClassForContent = (content: string) => {
    const words = content ? content.trim().split(/\s+/).length : 0;
    // If there's no wordLimit (fallback), use 80 as baseline
    const baseline = wordLimit || 80;
    const ratio = words / baseline;

    // Choose classes conservatively to preserve readability
    // ratio <=1 : default (larger)
    // ratio >1 and <=1.5 : slightly smaller
    // ratio >1.5 and <=2.5 : small
    // ratio >2.5 : extra-small
    if (ratio <= 1) return 'text-lg';
    if (ratio <= 1.5) return 'text-base';
    if (ratio <= 2.5) return 'text-sm';
    return 'text-xs';
  };

  const createStagePlan = async (genAI?: GenAIType, claude?: Anthropic) => {
    setProcessingStage('Creating stage plan...');

    const planPrompt = `Based on this document analysis, create a detailed stage plan with 5-6 stages.
Each stage should be relevant to the document type and domain.

Length mapping: Short = 50 words, Medium = 80 words, Long = 120 words.
Important: For each stage, the "description" field must be PLAIN TEXT only (no Markdown, no bullets, no lists), a SINGLE PARAGRAPH, and must NOT EXCEED ${wordLimit} words. Use concise, professional language.

Analysis: ${analysis}

User preferences:
- Genre/Style: ${selections.Genre || 'General'}
- Audience: ${selections.Audience || 'General'}
- Length: ${selections.Length || 'Medium'} (limit: ${wordLimit} words)

Return ONLY a JSON array of stages with this exact format (ensure description follows the rule above):
[
  {
    "name": "Stage Name",
    "description": "Brief description (single paragraph, ≤${wordLimit} words)",
    "color": "from-blue-400 to-cyan-400",
    "weight": 1.0
  }
]

Use these color options: "from-blue-400 to-cyan-400", "from-purple-400 to-pink-400", "from-green-400 to-emerald-400", "from-yellow-400 to-orange-400", "from-pink-400 to-rose-400", "from-indigo-400 to-purple-400"
Weight should be between 0.8 and 1.5 based on stage importance.`;

    let planText = '';

    if (provider === 'gemini' && genAI) {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const planResult = await model.generateContent(planPrompt);
      planText = planResult.response.text();
    } else if (provider === 'claude' && claude) {
      const message = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: planPrompt
        }]
      });

      const content = message.content[0];
      planText = content.type === 'text' ? content.text : '';
    }

    // Extract JSON from response
    const jsonMatch = planText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const stagesPlan = JSON.parse(jsonMatch[0]);
      setStages(stagesPlan);
      return stagesPlan;
    }

    // Fallback stages if parsing fails
    const fallbackStages = [
      { name: 'Analysis', description: 'Initial analysis and understanding', color: 'from-blue-400 to-cyan-400', weight: 1 },
      { name: 'Planning', description: 'Strategic planning and design', color: 'from-purple-400 to-pink-400', weight: 1.2 },
      { name: 'Development', description: 'Implementation and creation', color: 'from-green-400 to-emerald-400', weight: 1.5 },
      { name: 'Review', description: 'Testing and quality assurance', color: 'from-yellow-400 to-orange-400', weight: 1 },
      { name: 'Delivery', description: 'Final delivery and deployment', color: 'from-pink-400 to-rose-400', weight: 0.8 }
    ];
    setStages(fallbackStages);
    return fallbackStages;
  };

  // Agent 3: Create Content for Each Stage
  const createStageContent = async (stagePlan: Array<{ name: string, description: string, color: string, weight: number }>, vectorStore: Array<{ chunk: string, embedding: number[], index: number }>, genAI?: GenAIType, claude?: Anthropic) => {
    setProcessingStage('Generating content...');

    // Retrieve relevant context from vector store
    const contextChunks = vectorStore.slice(0, 3).map((v: { chunk: string }) => v.chunk).join('\n\n');

    // Generate content for ALL stages in ONE API call
    const stagesDescription = stagePlan.map((stage, index) =>
      `${index + 1}. ${stage.name}: ${stage.description}`
    ).join('\n');

    const contentPrompt = `Create detailed content for ALL the following stages in one response.

Context from document:
${contextChunks}

User preferences:

User preferences:
- Genre/Style: ${selections.Genre || 'General'}
- Audience: ${selections.Audience || 'General'}
- Length: ${selections.Length || 'Medium'} (target: ${wordLimit} words per stage)

Stages to create content for:
${stagesDescription}

For EACH stage, provide comprehensive, well-structured content that:
1. Is appropriate for the "${selections.Audience || 'General'}" audience
2. Follows a "${selections.Genre || 'General'}" style
3. Is ${selections.Length || 'Medium'} length
4. Includes specific actionable information
5. Relates directly to the uploaded document content
For EACH stage, provide comprehensive, well-structured content that:
1. Is appropriate for the "${selections.Audience || 'General'}" audience
2. Follows a "${selections.Genre || 'General'}" style
3. Is approximately ${wordLimit} words (do not exceed ${wordLimit} words)
4. Includes specific actionable information
5. Relates directly to the uploaded document content

Return the response in JSON format where each key is the stage name and the value is a single-paragraph plain-text string (no Markdown, no bullets):
{
  "${stagePlan[0].name}": "content here",
  "${stagePlan[1].name}": "content here",
  ...
}

Format each stage content as a single paragraph (no headers or lists).`;

    let responseText = '';

    if (provider === 'gemini' && genAI) {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const contentResult = await model.generateContent(contentPrompt);
      responseText = contentResult.response.text();
    } else if (provider === 'claude' && claude) {
      const message = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: contentPrompt
        }]
      });

      const content = message.content[0];
      responseText = content.type === 'text' ? content.text : '';
    }

    // Try to parse JSON response
    const contents: Record<string, string> = {};
    try {
      // Try multiple strategies to extract JSON
      let jsonText = '';

      // Strategy 1: Look for JSON code block
      const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        // Strategy 2: Find the first { and last } with proper nesting
        const firstBrace = responseText.indexOf('{');
        if (firstBrace !== -1) {
          let braceCount = 0;
          let lastBrace = firstBrace;
          for (let i = firstBrace; i < responseText.length; i++) {
            if (responseText[i] === '{') braceCount++;
            if (responseText[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                lastBrace = i;
                break;
              }
            }
          }
          jsonText = responseText.substring(firstBrace, lastBrace + 1);
        }
      }

      if (jsonText) {
        // Clean the JSON text
        jsonText = jsonText.trim();

        const parsedContents = JSON.parse(jsonText);

        // Convert each stage content to string (handle nested objects)
        Object.keys(parsedContents).forEach(stageName => {
          const content = parsedContents[stageName];

          // If content is an object, format it nicely
          if (typeof content === 'object' && content !== null) {
            const formattedContent = Object.entries(content)
              .map(([key, value]) => `${key}:\n${value}`)
              .join('\n\n');
            contents[stageName] = formattedContent;
          } else if (typeof content === 'string') {
            contents[stageName] = content;
          } else {
            contents[stageName] = String(content);
          }
        });
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (error) {
      console.error('Error parsing stage contents JSON:', error);

      // Fallback: Try to extract content per stage manually
      let foundContent = false;
      stagePlan.forEach(stage => {
        // Look for stage name in response
        const stagePattern = new RegExp(`["']?${stage.name}["']?\\s*:\\s*["']([\\s\\S]*?)["'](?:,|\\})`, 'i');
        const match = responseText.match(stagePattern);
        if (match) {
          contents[stage.name] = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          foundContent = true;
        } else {
          contents[stage.name] = `${stage.description}\n\nContent generated for ${stage.name} stage based on the uploaded document.`;
        }
      });

      if (!foundContent) {
        // Last resort: use the raw response split by stages
        stagePlan.forEach(stage => {
          contents[stage.name] = `${stage.description}\n\nContent generated for ${stage.name} stage based on the uploaded document.`;
        });
      }
    }

    setStageContents(contents);
    return contents;
  };

  // Main AI Pipeline - Only Agent 1 runs on file upload
  const processFileWithAI = async (file: File) => {
    const currentKey = provider === 'gemini' ? apiKey : claudeKey;
    if (!currentKey) {
      alert(`Please enter your ${provider === 'gemini' ? 'Google AI' : 'Claude'} API key first`);
      return;
    }

    setProcessing(true);

    try {
      // Read file content
      const fileContent = await file.text();

      if (provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(apiKey);
        await analyzeFileAndCreateEmbeddings(fileContent, genAI, undefined);
      } else {
        const claude = new Anthropic({ apiKey: claudeKey, dangerouslyAllowBrowser: true });
        await analyzeFileAndCreateEmbeddings(fileContent, undefined, claude);
      }

      setProcessing(false);
      setProcessingStage('');

    } catch (error) {
      console.error('Error processing file:', error);
      setProcessing(false);
      setProcessingStage('');
      alert('Error processing file. Please check your API key and try again.');
    }
  };

  // Run Agents 2 & 3 after all selections are made
  const generateStagesAndContent = async () => {
    const currentKey = provider === 'gemini' ? apiKey : claudeKey;
    if (!currentKey) {
      alert(`Please enter your ${provider === 'gemini' ? 'Google AI' : 'Claude'} API key first`);
      return;
    }

    setProcessing(true);

    try {
      if (provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(apiKey);
        const stagePlan = await createStagePlan(genAI, undefined);
        await createStageContent(stagePlan, vectorStore, genAI, undefined);
      } else {
        const claude = new Anthropic({ apiKey: claudeKey, dangerouslyAllowBrowser: true });
        const stagePlan = await createStagePlan(undefined, claude);
        await createStageContent(stagePlan, vectorStore, undefined, claude);
      }

      setProcessing(false);
      setProcessingStage('');

    } catch (error) {
      console.error('Error generating stages:', error);
      setProcessing(false);
      setProcessingStage('');
      alert('Error generating stages. Please try again.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFileWithAI(file);

      setSplitting(true);
      setFileUploaded(true);

      setTimeout(() => {
        const newBubbles = bubbleActions.map((action, index) => ({
          id: index,
          ...action,
          angle: (index * 120) - 90,
          popped: false,
          isAnimating: true
        }));
        setBubbles(newBubbles);

        setTimeout(() => {
          setSplitting(false);
          setBubbles(prev => prev.map(b => ({ ...b, isAnimating: false })));
        }, 1000);
      }, 100);
    }
  };

  const recalculateBubblePositions = (remainingBubbleIds: number[]) => {
    const numRemaining = remainingBubbleIds.length;
    const angleSpacing = 360 / numRemaining;

    setBubbles(prev => prev.map(b => {
      if (remainingBubbleIds.includes(b.id)) {
        const newIndex = remainingBubbleIds.indexOf(b.id);
        return {
          ...b,
          angle: (newIndex * angleSpacing) - 90
        };
      }
      return b;
    }));
  };

  const handleCategoryBubbleClick = (id: number) => {
    const clickedBubble = bubbles.find(b => b.id === id);
    if (!clickedBubble || clickedBubble.popped) {
      return;
    }

    // Mark as popped
    setBubbles(prev => prev.map(b =>
      b.id === id ? { ...b, popped: true } : b
    ));

    setTimeout(() => {
      // Recalculate positions for remaining category bubbles
      const remainingBubbleIds = bubbles.filter(b => !b.popped && b.id !== id).map(b => b.id);
      recalculateBubblePositions(remainingBubbleIds);

      // Calculate positions for new option bubbles considering ALL existing options
      const existingOptions = optionBubbles.filter(b => !b.popped);
      const numExistingOptions = existingOptions.length;
      const numNewOptions = clickedBubble.options.length;
      const totalOptions = numExistingOptions + numNewOptions;
      const angleSpacing = 360 / totalOptions;

      const newOptionBubbles = clickedBubble.options.map((option, index) => ({
        id: `${id}-${index}`,
        label: option,
        categoryId: id,
        categoryLabel: clickedBubble.label,
        color: clickedBubble.color,
        angle: ((numExistingOptions + index) * angleSpacing) - 90,
        popped: false,
        isAnimating: true
      }));

      // Recalculate existing option bubble positions
      setOptionBubbles(prev => {
        const updated = prev.map((bubble) => {
          if (!bubble.popped) {
            const existingIndex = existingOptions.findIndex(b => b.id === bubble.id);
            return {
              ...bubble,
              angle: (existingIndex * angleSpacing) - 90
            };
          }
          return bubble;
        });
        return [...updated, ...newOptionBubbles];
      });

      setTimeout(() => {
        setOptionBubbles(prev => prev.map(b =>
          newOptionBubbles.find(nb => nb.id === b.id) ? { ...b, isAnimating: false } : b
        ));
      }, 1000);
    }, 100);
  };

  // Spawn a ripple (reusing the original splash animation) at container-relative coordinates
  const spawnClickRipple = (x: number, y: number, size = 144) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setClickRipples(prev => [...prev, { id, x, y, size }]);
    // Remove after splash animation (0.6s) + small buffer
    setTimeout(() => {
      setClickRipples(prev => prev.filter(r => r.id !== id));
    }, 700);
  };

  const handleOptionBubbleClick = async (_id: string, categoryId: number, categoryLabel: string, option: string) => {
    setSelections(prev => ({ ...prev, [categoryLabel]: option }));

    // Mark all options from this category as popped
    setOptionBubbles(prev => prev.map(b =>
      b.categoryId === categoryId ? { ...b, popped: true } : b
    ));

    setTimeout(() => {
      // Filter and get remaining options BEFORE removing
      const remainingOptionsAfterRemoval = optionBubbles.filter(b => b.categoryId !== categoryId && !b.popped);

      // Remove popped options
      setOptionBubbles(prev => prev.filter(b => b.categoryId !== categoryId));

      const remainingBubbles = bubbles.filter(b => !b.popped);

      // Recalculate positions for remaining option bubbles
      if (remainingOptionsAfterRemoval.length > 0) {
        setTimeout(() => {
          const totalRemaining = remainingOptionsAfterRemoval.length;
          const angleSpacing = 360 / totalRemaining;

          setOptionBubbles(prev => prev.map((bubble, index) => {
            if (!bubble.popped) {
              return {
                ...bubble,
                angle: (index * angleSpacing) - 90
              };
            }
            return bubble;
          }));
        }, 100);
      }

      // Check if all selections are complete
      if (remainingBubbles.length === 0 && remainingOptionsAfterRemoval.length === 0) {
        // Run Agents 2 & 3 before transitioning
        (async () => {
          await generateStagesAndContent();

          setTransitioning(true);
          setTimeout(() => {
            setView('cycle');
            setTransitioning(false);
          }, 1500);
        })();
      }
    }, 600);
  };

  const handleStageClick = (index: number) => {
    if (isRotating) return;
    setIsRotating(true);
    setActiveStage(index);
    setTimeout(() => setIsRotating(false), 500);
  };

  const handleCenterClick = () => {
    // Clear cached state
    localStorage.removeItem('projectstory-state');

    setView('initial');
    setFileUploaded(false);
    setBubbles([]);
    setOptionBubbles([]);
    setSelections({});
    setSplitting(false);
    setActiveStage(0);
    setStages([]);
    setStageContents({});
    setVectorStore([]);
  };

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (view !== 'cycle' || isRotating || stages.length === 0) return;

      setIsRotating(true);
      const direction = e.deltaY > 0 ? 1 : -1;
      setActiveStage((prev: number) => (prev + direction + stages.length) % stages.length);

      setTimeout(() => setIsRotating(false), 300);
    };

    if (view === 'cycle') {
      window.addEventListener('wheel', handleWheel);
      return () => window.removeEventListener('wheel', handleWheel);
    }
  }, [view, isRotating, stages]);

  const getBubblePosition = (angle: number, radius = 160) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius
    };
  };

  const getOptionBubblePosition = (angle: number, radius = 280) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius
    };
  };

  const getArrowPosition = (index: number, total: number) => {
    const angle = (index * (360 / total)) + (activeStage * -(360 / total));
    const rad = (angle * Math.PI) / 180;
    const radius = 120;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
      rotation: angle + 90
    };
  };

  return (
    <div ref={containerRef} onClick={(e) => {
      // Only spawn ripple when clicking on non-interactive areas
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input')) return;
      const rect = containerRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : e.clientX;
      const y = rect ? e.clientY - rect.top : e.clientY;
      spawnClickRipple(x, y, 144);
    }} className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 overflow-hidden relative"
      style={{ overscrollBehavior: 'none', touchAction: 'manipulation' } as React.CSSProperties}>
      {/* API Key Input Modal */}
      {showApiInput && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-light text-white mb-4">Choose AI Provider</h2>

            {/* Provider Selection */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setProvider('gemini')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${provider === 'gemini'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-400 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
              >
                Google Gemini
              </button>
              <button
                onClick={() => setProvider('claude')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${provider === 'claude'
                    ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
              >
                Anthropic Claude
              </button>
            </div>

            {provider === 'gemini' ? (
              <>
                <p className="text-white/70 text-sm mb-6">
                  Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google AI Studio</a>, which will be used to derive your <a href="https://github.com/ak-asu/SmallProjects/tree/main/projectstory" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Project Story</a>.
                </p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 mb-4"
                />
              </>
            ) : (
              <>
                <p className="text-white/70 text-sm mb-6">
                  Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Anthropic Console</a>, which will be used to derive your <a href="https://github.com/ak-asu/SmallProjects/tree/main/projectstory" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Project Story</a>.
                </p>
                <input
                  type="password"
                  value={claudeKey}
                  onChange={(e) => setClaudeKey(e.target.value)}
                  placeholder="Enter your Claude API key"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 mb-4"
                />
              </>
            )}

            <button
              onClick={() => setShowApiInput(false)}
              disabled={provider === 'gemini' ? !apiKey : !claudeKey}
              className={`w-full py-3 ${provider === 'gemini'
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-400'
                  : 'bg-gradient-to-r from-purple-400 to-pink-400'
                } text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-1">
              {processingStage.split('').map((char, index) => (
                <span
                  key={index}
                  className="text-cyan-400 text-2xl font-light inline-block"
                  style={{
                    animation: `wave 1.5s ease-in-out infinite`,
                    animationDelay: `${index * 0.05}s`
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {bgBlobsRef.current.map((b, i) => {
          const s: { [key: string]: string | number } = {
            width: `${b.width}px`,
            height: `${b.height}px`,
            left: `${b.left}%`,
            top: `${b.top}%`,
            animation: `float var(--float-duration-${i}) infinite ease-in-out`,
            animationDelay: `var(--float-delay-${i})`
          };
          s[`--float-x`] = `${b.floatX}px`;
          s[`--float-y`] = `${b.floatY}px`;
          s[`--float-duration-${i}`] = `${b.duration}s`;
          s[`--float-delay-${i}`] = `${b.delay}s`;
          return (
            <div
              key={i}
              className="absolute rounded-full bg-white opacity-5"
              style={s as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* Cursor-tied splash ripples (reuses original splash animation) */}
      <div className="absolute inset-0 pointer-events-none">
        {clickRipples.map(r => (
          <div
            key={r.id}
            className="absolute rounded-full bg-white/20"
            style={{
              left: r.x,
              top: r.y,
              width: `${r.size}px`,
              height: `${r.size}px`,
              transform: 'translate(-50%, -50%)',
              animation: 'splash 0.6s ease-out forwards',
              zIndex: 70
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(var(--float-x, 0px), var(--float-y, 0px)) scale(1.1); }
        }
        @keyframes wiggle {
          0%, 100% { border-radius: 50% 48% 52% 50%; }
          25% { border-radius: 48% 52% 50% 48%; }
          50% { border-radius: 52% 50% 48% 52%; }
          75% { border-radius: 50% 48% 52% 50%; }
        }
        @keyframes wigglerect {
          /* Morph the corners AND apply subtle transforms so the straight edges "wiggle" visually */
          0%, 100% {
            border-radius: 30px 40px 20px 30px;
            transform: translateY(0) rotate(0deg) skewX(0deg);
            box-shadow: 0 10px 30px rgba(0,0,0,0.20);
          }
          25% {
            border-radius: 20px 30px 40px 20px;
            transform: translateY(-4px) rotate(-1deg) skewX(-1deg);
            box-shadow: 0 12px 32px rgba(0,0,0,0.22);
          }
          50% {
            border-radius: 40px 20px 30px 40px;
            transform: translateY(4px) rotate(1deg) skewX(1deg);
            box-shadow: 0 8px 28px rgba(0,0,0,0.18);
          }
          75% {
            border-radius: 30px 40px 20px 30px;
            transform: translateY(-2px) rotate(-0.5deg) skewX(-0.5deg);
            box-shadow: 0 11px 30px rgba(0,0,0,0.20);
          }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes splash {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(3) translateY(-50px); opacity: 0; }
        }
        @keyframes waterTransition {
          0% { transform: scale(1) translateY(0); opacity: 1; }
          50% { transform: scale(5) translateY(-20px); opacity: 0.5; }
          100% { transform: scale(10) translateY(0); opacity: 0; }
        }
        @keyframes wave {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes splitOutDynamic {
          0% { 
            transform: translate(-50%, -50%) scale(0.5); 
            opacity: 0; 
          }
          100% { 
            transform: translate(calc(-50% + var(--target-x)), calc(-50% + var(--target-y))) scale(1); 
            opacity: 1; 
          }
        }
        @keyframes splitOutOptionDynamic {
          0% { 
            transform: translate(-50%, -50%) scale(0.5); 
            opacity: 0; 
          }
          100% { 
            transform: translate(calc(-50% + var(--target-x)), calc(-50% + var(--target-y))) scale(1); 
            opacity: 1; 
          }
        }
        
      `}</style>

      {/* Initial View */}
      {view === 'initial' && (
        <div className="relative h-screen flex items-center justify-center">
          {transitioning && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl"
              style={{ animation: 'waterTransition 1.5s ease-out forwards' }}
            />
          )}

          {!fileUploaded ? (
            <div className="relative">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-0 border-2 border-white/20 rounded-full"
                  style={{
                    animation: `ripple 3s infinite ease-out`,
                    animationDelay: `${i * 1}s`
                  }}
                />
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative w-44 h-44 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 hover:bg-white/15"
                style={{ animation: 'wiggle 4s infinite ease-in-out' }}
              >
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/5 to-transparent" />
                <Upload className="w-14 h-14 text-white/80" strokeWidth={1.5} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.md,image/*"
                className="hidden"
              />
            </div>
          ) : (
            <div className="relative">
              {splitting && (
                <div className="absolute left-1/2 top-1/2 w-36 h-36 -translate-x-1/2 -translate-y-1/2 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"
                  style={{ animation: 'splash 0.6s ease-out forwards' }} />
              )}
              {bubbles.filter(b => !b.popped).map((bubble, index) => {
                const pos = getBubblePosition(bubble.angle);
                const Icon = bubble.icon;

                return (
                  <button
                    key={bubble.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      // spawn ripple at click location
                      const rect = containerRef.current?.getBoundingClientRect();
                      const x = rect ? e.clientX - rect.left : e.clientX;
                      const y = rect ? e.clientY - rect.top : e.clientY;
                      spawnClickRipple(x, y, 144);
                      handleCategoryBubbleClick(bubble.id);
                    }}
                    className="absolute w-28 h-28 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl flex flex-col items-center justify-center gap-1 hover:scale-110 hover:bg-white/15 transition-transform duration-500 cursor-pointer"
                    style={{
                      left: '50%',
                      top: '50%',
                      '--target-x': `${pos.x}px`,
                      '--target-y': `${pos.y}px`,
                      animation: bubble.isAnimating
                        ? `splitOutDynamic 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, wiggle 3s infinite ease-in-out ${0.8 + index * 0.2}s`
                        : `wiggle 3s infinite ease-in-out`,
                      animationDelay: bubble.isAnimating ? `${index * 0.15}s, ${0.8 + index * 0.2}s` : '0s',
                      transform: !bubble.isAnimating ? `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` : undefined,
                      zIndex: 10 + bubble.id,
                      pointerEvents: 'auto'
                    } as React.CSSProperties}
                  >
                    <div className={`absolute inset-2 rounded-full bg-gradient-to-br ${bubble.color} opacity-20 pointer-events-none`} />
                    <Icon className="w-10 h-10 text-white/80 relative z-10 pointer-events-none" strokeWidth={1.5} />
                    <span className="text-white/70 text-sm font-light relative z-10 pointer-events-none">{bubble.label}</span>
                  </button>
                );
              })}

              {optionBubbles.filter(b => !b.popped).map((bubble, globalIndex) => {
                const pos = getOptionBubblePosition(bubble.angle);

                return (
                  <button
                    key={bubble.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = containerRef.current?.getBoundingClientRect();
                      const x = rect ? e.clientX - rect.left : e.clientX;
                      const y = rect ? e.clientY - rect.top : e.clientY;
                      spawnClickRipple(x, y, 112);
                      handleOptionBubbleClick(bubble.id, bubble.categoryId, bubble.categoryLabel, bubble.label);
                    }}
                    className="absolute w-24 h-24 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl flex items-center justify-center hover:scale-110 hover:bg-white/15 transition-transform duration-500 cursor-pointer"
                    style={{
                      left: '50%',
                      top: '50%',
                      '--target-x': `${pos.x}px`,
                      '--target-y': `${pos.y}px`,
                      animation: bubble.isAnimating
                        ? `splitOutOptionDynamic 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, wiggle 3s infinite ease-in-out ${0.8 + globalIndex * 0.15}s`
                        : `wiggle 3s infinite ease-in-out`,
                      animationDelay: bubble.isAnimating ? `${globalIndex * 0.1}s, ${0.8 + globalIndex * 0.15}s` : '0s',
                      transform: !bubble.isAnimating ? `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` : undefined,
                      zIndex: 20 + globalIndex,
                      pointerEvents: 'auto'
                    } as React.CSSProperties}
                  >
                    <div className={`absolute inset-2 rounded-full bg-gradient-to-br ${bubble.color} opacity-20 pointer-events-none`} />
                    <span className="text-white/80 text-xs font-light relative z-10 text-center px-2 pointer-events-none">{bubble.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cycle View */}
      {view === 'cycle' && stages.length > 0 && (
        <div className="h-screen flex items-center">
          <div className="w-1/3 h-full flex items-center justify-center relative">
            <div className="relative w-80 h-80">
              {stages.map((stage, index) => {
                const pos = getArrowPosition(index, stages.length);
                const isActive = index === activeStage;
                const arrowLength = 50 + (stage.weight * 40);

                return (
                  <button
                    key={index}
                    onClick={() => handleStageClick(index)}
                    className={`absolute backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl transition-all duration-500 ${isActive ? 'scale-125 bg-white/20' : 'hover:scale-110 hover:bg-white/15'
                      }`}
                    style={{
                      left: '50%',
                      top: '50%',
                      width: `${arrowLength}px`,
                      height: `60px`,
                      borderRadius: '30px',
                      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) rotate(${pos.rotation}deg)`,
                      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                      clipPath: 'polygon(0% 30%, 70% 30%, 70% 0%, 100% 50%, 70% 100%, 70% 70%, 0% 70%)'
                    }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${stage.color} opacity-60`}
                      style={{ clipPath: 'inherit' }} />
                  </button>
                );
              })}

              {/* Center Circle */}
              <button
                onClick={handleCenterClick}
                className="absolute left-1/2 top-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full backdrop-blur-xl bg-white/10 border border-white/30 hover:bg-white/20 hover:scale-110 transition-all duration-300 flex items-center justify-center shadow-xl"
              >
                <RotateCcw className="w-8 h-8 text-white/70" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Right Side - Stage Information */}
          <div className="w-2/3 h-full flex items-center justify-center p-12 m-4">
            <div
              className="w-full max-w-2xl p-4 backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl transition-all duration-500"
              style={{ animation: 'wigglerect 6s infinite ease-in-out' }}
            >
              <h2 className="text-4xl font-light text-white mb-6 relative z-10">
                {stages[activeStage].name}
              </h2>
              <p className="text-lg text-white/70 leading-relaxed relative z-10 whitespace-pre-wrap">
                {/* Adjust font size based on content length and selected word limit */}
                <span className={`${getFontClassForContent(stageContents[stages[activeStage].name] || stages[activeStage].description)} text-white/70 leading-relaxed relative z-10 whitespace-pre-wrap`}>
                  {stageContents[stages[activeStage].name] || stages[activeStage].description}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;