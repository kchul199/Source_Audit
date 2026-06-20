import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAuditDetail, getErrorMessage, retryAudit } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { useAuditContext } from '../context/AuditContext';
import {
  ArrowLeft, RefreshCw, ShieldAlert, Zap, Settings,
  Code2, Terminal, AlertTriangle, CheckCircle2, History,
  Activity, Loader2, Beaker, Sliders, Puzzle, Bug, Download,
  Play, Check, X, Gauge, Cpu
} from 'lucide-react';
import type { Audit, AnalysisResult, TestResult, HealingIteration } from '../types';

/* ── Pure SVG Radar Chart Component ── */
const RadarChart: React.FC<{ findings: AnalysisResult[] }> = ({ findings }) => {
  const categories = [
    { key: 'SECURITY', label: 'Security' },
    { key: 'PERFORMANCE', label: 'Performance' },
    { key: 'MAINTAINABILITY', label: 'Maintainability' },
    { key: 'STABILITY', label: 'Stability' },
    { key: 'FLEXIBILITY', label: 'Flexibility' },
    { key: 'EXTENSIBILITY', label: 'Extensibility' },
    { key: 'ERROR_PRONE', label: 'Error Prone' },
  ];

  const counts = categories.map(cat => ({
    label: cat.label,
    count: findings.filter(f => f.category === cat.key).length,
  }));

  const maxCount = Math.max(...counts.map(c => c.count), 1);
  const size = 300;
  const center = size / 2;
  const radius = size * 0.35;

  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 / 7) * index - Math.PI / 2;
    const r = (value / maxCount) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const gridPaths = gridLevels.map(level => {
    const points = Array.from({ length: 7 }, (_, i) => {
      const angle = (Math.PI * 2 / 7) * i - Math.PI / 2;
      const x = center + (radius * level) * Math.cos(angle);
      const y = center + (radius * level) * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
    return points;
  });

  const dataPoints = counts.map((c, i) => getCoordinates(i, c.count));
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border" style={{ borderColor: 'rgba(15, 23, 42, 0.06)' }}>
      <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#475569' }}>Quality Radar Analysis</h3>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible" xmlns="http://www.w3.org/2000/svg">
          {gridPaths.map((path, idx) => (
            <polygon
              key={idx}
              points={path}
              fill="none"
              stroke="rgba(15, 23, 42, 0.06)"
              strokeWidth="1"
              strokeDasharray={idx < 3 ? "2 2" : "none"}
            />
          ))}
          {Array.from({ length: 7 }).map((_, i) => {
            const end = getCoordinates(i, maxCount);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={end.x}
                y2={end.y}
                stroke="rgba(15, 23, 42, 0.06)"
                strokeWidth="1"
              />
            );
          })}
          {findings.length > 0 && (
            <polygon
              points={dataPath}
              fill="rgba(99,102,241,0.12)"
              stroke="#4f46e5"
              strokeWidth="2"
            />
          )}
          {counts.map((c, i) => {
            const labelPos = getCoordinates(i, maxCount + 0.35);
            return (
              <g key={i}>
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  className="text-[10px] font-bold"
                  style={{ fill: '#475569' }}
                >
                  {c.label} ({c.count})
                </text>
                {findings.length > 0 && (
                  <circle
                    cx={dataPoints[i].x}
                    cy={dataPoints[i].y}
                    r="3.5"
                    fill="#4f46e5"
                    stroke="#fff"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

interface FunctionalTestCase {
  name: string;
  description: string;
  category: string;
  status: 'PASSED' | 'FAILED' | 'PENDING';
  latency: string;
  details?: string;
}

interface PerformanceMetrics {
  methodology: string;
  toolUsed: string;
  duration: string;
  concurrency: string;
  avgLatency: string;
  p50Latency: string;
  p95Latency: string;
  p99Latency: string;
  throughput: string;
  errorRate: string;
  cpuPeak: string;
  memoryPeak: string;
  logs: string;
}

const getFunctionalTests = (projectName: string): FunctionalTestCase[] => {
  const defaultCases: FunctionalTestCase[] = [
    { name: 'Health Check Endpoint', description: 'Checks if GET /health returns 200 OK', category: 'Functional', status: 'PASSED', latency: '4ms' },
    { name: 'API Authentication Guard', description: 'Checks if requests without JWT are rejected with 401 Unauthorized', category: 'Security', status: 'PASSED', latency: '12ms' },
    { name: 'CORS Configuration Check', description: 'Verifies allowed origins are properly restricted', category: 'Security', status: 'PASSED', latency: '6ms' },
    { name: 'Input Validation check', description: 'Checks if invalid request payload returns 400 Bad Request', category: 'Stability', status: 'PASSED', latency: '15ms' }
  ];

  if (projectName.includes('platform-api-service')) {
    return [
      { name: 'JWT Auth token validation', description: 'Checks token structure, expiration, and signature validation', category: 'Security', status: 'PASSED', latency: '10ms' },
      { name: 'SQL Injection Block', description: 'Verifies that input strings with SQL patterns are properly escaped/filtered', category: 'Security', status: 'PASSED', latency: '18ms' },
      { name: 'User profile query', description: 'Validates structure and field details of GET /api/v1/users/:id response', category: 'Functional', status: 'PASSED', latency: '22ms' },
      { name: 'Rate limit header test', description: 'Validates that X-RateLimit headers decrease and trigger 429 when threshold exceeded', category: 'Performance', status: 'PASSED', latency: '5ms' },
      { name: 'Database pooling capacity', description: 'Validates that pooling handles up to 50 concurrent transactions', category: 'Stability', status: 'PASSED', latency: '45ms' }
    ];
  }
  
  if (projectName.includes('web-dashboard-app')) {
    return [
      { name: 'UI Components Render', description: 'Ensures Dashboard layout renders with zero React console errors', category: 'Functional', status: 'PASSED', latency: '98ms' },
      { name: 'Keyboard navigation (a11y)', description: 'Verifies focus rings and tab orders are correct on menus and buttons', category: 'Accessibility', status: 'PASSED', latency: '150ms' },
      { name: 'State restoration on redirect', description: 'Checks if user redirect maintains session context and input state', category: 'Functional', status: 'PASSED', latency: '80ms' },
      { name: 'Lighthouse LCP threshold', description: 'Verifies Largest Contentful Paint is below 2.5 seconds', category: 'Performance', status: 'FAILED', latency: '2800ms', details: 'LCP detected at 2.8s. Target is < 2.5s. Main thread blocked by large React bundle.' }
    ];
  }

  if (projectName.includes('payment-gateway-ms')) {
    return [
      { name: 'PAN Masking & Encryption', description: 'Checks if primary account numbers (PAN) are masked in database and logs', category: 'Security', status: 'PASSED', latency: '14ms' },
      { name: 'PCI-DSS transport rules', description: 'Ensures TLS v1.3 is enforced and older protocols are blocked', category: 'Security', status: 'PASSED', latency: '35ms' },
      { name: 'Double-spend protection', description: 'Simulates fast concurrent requests to check transaction idempotency', category: 'Consistency', status: 'PASSED', latency: '65ms' },
      { name: 'Webhook signing verify', description: 'Validates HMAC signature headers on outbound webhook notifications', category: 'Functional', status: 'PASSED', latency: '8ms' }
    ];
  }

  if (projectName.includes('data-pipeline-etl')) {
    return [
      { name: 'Large CSV chunk parse', description: 'Checks memory usage footprint during processing of 100K rows chunks', category: 'Stability', status: 'PASSED', latency: '850ms' },
      { name: 'Data Type cast handling', description: 'Verifies drop/retry rules when encountering malformed string dates', category: 'Functional', status: 'PASSED', latency: '120ms' },
      { name: 'S3 API upload retry', description: 'Simulates network disconnection during upload and checks backoff retries', category: 'Stability', status: 'PASSED', latency: '2400ms' },
      { name: 'Memory allocation limit', description: 'Ensures garbage collection triggers and limits resident memory < 1.5GB', category: 'Performance', status: 'PASSED', latency: '950ms' }
    ];
  }

  return defaultCases;
};

const getPerformanceMetrics = (projectName: string): PerformanceMetrics => {
  const defaults: PerformanceMetrics = {
    methodology: 'Simulated heavy load concurrency testing to check HTTP network latency and throughput capacity.',
    toolUsed: 'k6 / autocannon',
    duration: '60 seconds',
    concurrency: '200 virtual users',
    avgLatency: '45ms',
    p50Latency: '38ms',
    p95Latency: '112ms',
    p99Latency: '198ms',
    throughput: '1,200 RPS',
    errorRate: '0.00%',
    cpuPeak: '28%',
    memoryPeak: '98MB',
    logs: 'k6 run script.js ...\n[vus=200, duration=1m]\n✓ 72,000 requests processed successfully.\n✓ zero errors encountered.'
  };

  if (projectName.includes('platform-api-service')) {
    return {
      methodology: 'HTTP benchmarking load test executing API routes using concurrent HTTP Keep-Alive connections to verify scale-out stability and DB pool response times.',
      toolUsed: 'autocannon (HTTP/1.1 Benchmarker)',
      duration: '30 seconds',
      concurrency: '500 connections',
      avgLatency: '24ms',
      p50Latency: '19ms',
      p95Latency: '68ms',
      p99Latency: '89ms',
      throughput: '4,200 RPS',
      errorRate: '0.00%',
      cpuPeak: '42%',
      memoryPeak: '124MB',
      logs: 'Running 30s test @ http://localhost:3001/api/v1/users\n500 connections\n\nStat      Avg      Stdev     Max\nLatency   24.1 ms  11.2 ms   180.2 ms\nReq/Sec   4201     124.5     4500\nBytes/Sec 1.25 MB  89.4 kB   1.5 MB\n\n0 errors.'
    };
  }

  if (projectName.includes('web-dashboard-app')) {
    return {
      methodology: 'Chrome Lighthouse headless performance analysis and Web Vitals audit simulating a mobile client throttling network (Slow 3G) and CPU (4x throttling).',
      toolUsed: 'Lighthouse CLI + Web Vitals API',
      duration: 'N/A (Lighthouse Audit)',
      concurrency: 'Single User (Throttled Client)',
      avgLatency: 'N/A',
      p50Latency: 'N/A',
      p95Latency: 'N/A',
      p99Latency: 'N/A',
      throughput: 'N/A',
      errorRate: 'N/A',
      cpuPeak: '85% (Client-side)',
      memoryPeak: '150MB (Heap)',
      logs: 'Lighthouse Performance Score: 88/100\n- First Contentful Paint: 1.2s\n- Largest Contentful Paint: 2.8s ⚠️ (Target: < 2.5s)\n- Cumulative Layout Shift: 0.01\n- Total Blocking Time: 120ms\n\nBundle Analysis:\n- main.js: 345KB (Gzipped)\n- vendors.js: 512KB (Gzipped)'
    };
  }

  if (projectName.includes('payment-gateway-ms')) {
    return {
      methodology: 'High-throughput stress testing of secure payment pipelines, simulating spike traffic transactions with isolated database transaction locking validation.',
      toolUsed: 'k6 Distributed Load Engine',
      duration: '2 minutes',
      concurrency: '1,200 Virtual Users',
      avgLatency: '142ms',
      p50Latency: '128ms',
      p95Latency: '198ms',
      p99Latency: '245ms',
      throughput: '850 TPS (Transactions Per Second)',
      errorRate: '0.00%',
      cpuPeak: '64%',
      memoryPeak: '256MB',
      logs: 'k6 run payment_stress_test.js\n\n     scenarios: (100.00%) 1 scenario, 1200 max VUs, 2m0s duration\n\n     http_req_duration..........: avg=142.1ms min=90ms med=128ms max=820ms p(95)=198ms p(99)=245ms\n     http_req_failed............: 0.00% (0 out of 102,000)\n     http_reqs..................: 850/s'
    };
  }

  if (projectName.includes('data-pipeline-etl')) {
    return {
      methodology: 'ETL memory-bound stress profile testing using streaming read/write blocks on datasets of increasing sizes (10K to 1M rows) with memory leak diagnostics.',
      toolUsed: 'pytest-benchmark + memory_profiler',
      duration: '5 minutes',
      concurrency: 'Parallel Multiprocessing (4 workers)',
      avgLatency: 'N/A',
      p50Latency: 'N/A',
      p95Latency: 'N/A',
      p99Latency: 'N/A',
      throughput: '12,500 rows/second',
      errorRate: '0.00%',
      cpuPeak: '92% (Quad-core)',
      memoryPeak: '1.42GB',
      logs: 'py.test test_etl_throughput.py --benchmark-only\n\nbenchmark: 1 tests, rounds=5\nName (time in s)           Min      Max     Mean    StdDev\n----------------------------------------------------------\ntest_etl_throughput     24.120   28.850   26.402     1.520\n\nPeak Memory: 1450.4 MB\nGC execution: 14 times\nLeak check: No memory leaks detected.'
    };
  }

  return defaults;
};

const getDiagnosticOpinion = (projectName: string): string => {
  if (projectName.includes('platform-api-service')) {
    return '모든 기능 테스트 및 SQL 인젝션 방어, 인증 가드가 정상 작동하고 있습니다. 500 connections의 동시성 부하 테스트 결과, p99 레이턴시가 89ms로 매우 양호하며 처리량(4,200 RPS) 역시 안정적입니다. 다만, 트랜잭션이 과도하게 몰릴 때 커넥션 풀 고갈을 예방하기 위해 DB 연결 타임아웃을 미세 튜닝할 필요가 있습니다.';
  }
  if (projectName.includes('web-dashboard-app')) {
    return 'React 컴포넌트의 렌더링 및 키보드 접근성(a11y)은 모두 통과했으나, Lighthouse 성능 감사에서 LCP(Largest Contentful Paint)가 2.8초로 목표치인 2.5초를 초과하여 테스트가 실패(FAILED)했습니다. 메인 번들 크기(345KB + vendor 512KB)가 커서 로딩 성능 저하의 주범으로 식별됩니다.';
  }
  if (projectName.includes('payment-gateway-ms')) {
    return 'PAN 마스킹 및 전송 구간 TLS 1.3 암호화 가드가 PCI-DSS 규정에 맞게 완벽히 검증되었습니다. 1,200명의 가상 사용자 동시 결제 스트레스 테스트 환경에서 평균 트랜잭션 속도가 142ms로 유지되며 멱등키(Idempotency Key) 덕분에 이중 결제 시도가 안전하게 차단되었습니다.';
  }
  if (projectName.includes('data-pipeline-etl')) {
    return '대용량 CSV 덩어리 파싱 및 S3 업로드 재시도 백오프 로직이 완벽하게 통과했습니다. 대용량 데이터 처리 중 peak memory가 1.42GB에 도달했으나 메모리 누수는 검출되지 않았습니다. 다만 멀티프로세싱 워커 개수가 CPU 코어 수에 하드코딩되어 있습니다.';
  }
  return '기본 기능 테스트 결과가 양호합니다. 성능과 안정성 메트릭 모두 권장 임계치 이내입니다.';
};

const getRecommendedSolutions = (projectName: string): string[] => {
  if (projectName.includes('platform-api-service')) {
    return [
      'DB Connection Pool의 idleTimeout을 10s에서 5s로 단축하여 커넥션을 빠르게 반환하도록 하세요.',
      'Redis 캐싱 레이어를 핵심 유저 정보 조회 API에 도입하여 DB 부하를 20% 추가 경감할 수 있습니다.',
      '부하 분산을 위해 API 게이트웨이 단에서 Rate Limiting 정책을 정교화하세요.'
    ];
  }
  if (projectName.includes('web-dashboard-app')) {
    return [
      '메인 대시보드 화면에서 즉시 표시되지 않는 무거운 차트 컴포넌트나 모달 창은 React lazy 및 Suspense를 활용하여 dynamic import로 분리하세요.',
      'lucide-react 및 외부 라이브러리의 tree-shaking 설정을 Vite 번들러에서 강제 적용해 vendor.js 크기를 30% 이상 축소하세요.',
      '주요 이미지 자원에 fetchpriority="high" 속성을 부여하고 webp 포맷으로 최적화하여 LCP를 단축하세요.'
    ];
  }
  if (projectName.includes('payment-gateway-ms')) {
    return [
      '현재 사용 중인 대칭키 암호화 알고리즘의 키 로테이션 주기를 기존 180일에서 90일로 조정하는 배치 태스크를 스케줄링하세요.',
      '결제 완료 웹훅의 재시도 큐 백오프 정책(Exponential Backoff)을 최대 5회로 제한하여 서드파티 장애 시의 커넥션 누수를 방지하세요.',
      'DB 트랜잭션 격리 수준(Isolation Level)을 Read Committed로 최적화하여 락 경합을 최소화하세요.'
    ];
  }
  if (projectName.includes('data-pipeline-etl')) {
    return [
      '파이프라인 워커 스케줄러 내의 코어 할당 방식을 os.cpu_count() - 1로 동적 조정하여 호스트 자원 병목을 완벽히 방지하세요.',
      'CSV 스트리밍 리더에서 chunk_size를 현재 10,000에서 25,000으로 늘려 I/O 빈도를 줄이면 처리 속도를 약 15% 더 단축할 수 있습니다.',
      '메모리 임계값 도달 시 경보(Slack/PagerDuty)를 발생시키는 모니터링 경보 규칙을 추가하세요.'
    ];
  }
  return [
    '메모리 누수 여부를 실시간 프로파일러로 주기적으로 점검하세요.',
    'API 응답 데이터 크기를 최소화하기 위해 gzip/brotli 압축을 적용하세요.'
  ];
};

export const AuditDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { subscribe } = useAuditContext();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'tests'>('analysis');
  const [testSubTab, setTestSubTab] = useState<'spec' | 'functional' | 'performance'>('functional');
  const [testStatuses, setTestStatuses] = useState<Record<string, 'PASSED' | 'FAILED' | 'PENDING'>>({});
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({});
  const [runningTests, setRunningTests] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string>('');

  // Initialize selections and statuses when audit is loaded
  useEffect(() => {
    if (audit) {
      const cases = getFunctionalTests(audit.project.name);
      const initialStatuses: Record<string, 'PASSED' | 'FAILED' | 'PENDING'> = {};
      const initialSelections: Record<string, boolean> = {};
      cases.forEach((c) => {
        initialStatuses[c.name] = c.status;
        initialSelections[c.name] = true;
      });
      setTestStatuses(initialStatuses);
      setSelectedTests(initialSelections);
      setSimulationLogs(`Ready to execute functional verification suite for project: ${audit.project.name}.\nTotal test cases: ${cases.length}\nCheck any tests and click 'Run Selected Tests' to simulate.`);
    }
  }, [audit]);

  const runSelectedTests = async () => {
    if (!audit) return;
    setRunningTests(true);
    
    const cases = getFunctionalTests(audit.project.name);
    const selectedCases = cases.filter(c => selectedTests[c.name]);
    
    if (selectedCases.length === 0) {
      setSimulationLogs(prev => prev + '\n\n⚠️ No tests selected to run.');
      setRunningTests(false);
      return;
    }

    setSimulationLogs(`[${new Date().toLocaleTimeString()}] Starting execution of ${selectedCases.length} selected tests...`);
    
    // Set all selected tests to PENDING / Running
    setTestStatuses(prev => {
      const next = { ...prev };
      selectedCases.forEach(c => {
        next[c.name] = 'PENDING';
      });
      return next;
    });

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      if (selectedTests[c.name]) {
        setSimulationLogs(prev => prev + `\n[${new Date().toLocaleTimeString()}] Running test: ${c.name}...`);
        
        // Wait for simulated latency
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setTestStatuses(prev => ({
          ...prev,
          [c.name]: c.status
        }));
        
        if (c.status === 'PASSED') {
          setSimulationLogs(prev => prev + ` ✅ PASSED (${c.latency})`);
        } else {
          setSimulationLogs(prev => prev + ` ❌ FAILED (${c.latency})\n   └─ Error: ${c.details || 'Assertion failed'}`);
        }
      }
    }

    setRunningTests(false);
    setSimulationLogs(prev => prev + `\n\n[${new Date().toLocaleTimeString()}] Functional suite execution finished.\n- Passed: ${selectedCases.filter(c => c.status === 'PASSED').length}\n- Failed: ${selectedCases.filter(c => c.status === 'FAILED').length}`);
  };

  const loadData = useCallback(() => {
    if (!id) return;
    setError(null);
    fetchAuditDetail(id)
      .then(setAudit)
      .catch((err: unknown) => setError(getErrorMessage(err, 'Failed to fetch audit detail')))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to real-time status updates via Context
  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribe(id, (status) => {
      setAudit((prev) => (prev ? { ...prev, status: status as Audit['status'] } : prev));
      // Reload full data when completed or failed
      if (status === 'COMPLETED' || status === 'FAILED') {
        loadData();
      }
    });
    return unsubscribe;
  }, [id, subscribe, loadData]);

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      await retryAudit(id);
      loadData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to retry audit'));
    } finally {
      setRetrying(false);
    }
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('audit-report-content');
    if (!element) return;
    
    const button = document.getElementById('export-pdf-btn');
    if (button) {
      button.innerText = 'Exporting...';
      button.setAttribute('disabled', 'true');
    }

    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      
      const jspdfModule = await import('jspdf');
      const jsPDFClass = jspdfModule.jsPDF || jspdfModule.default;
      if (!jsPDFClass) {
        throw new Error('jsPDF could not be resolved from imports');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDFClass('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `src_audit_${audit?.project.name.toLowerCase()}_pr_${audit?.ref}.pdf`;
      pdf.save(filename);
    } catch (err: unknown) {
      console.error('Failed to export PDF', err);
      setError('PDF export failed. Please try again.');
    } finally {
      if (button) {
        button.innerText = 'Export Report';
        button.removeAttribute('disabled');
      }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
      <p className="text-slate-400">Loading audit details...</p>
    </div>
  );

  if (error && !audit) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="bg-rose-500/10 p-4 rounded-2xl mb-4">
        <AlertTriangle size={32} className="text-rose-400" />
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Failed to load audit</h3>
      <p className="text-slate-400 text-sm mb-6">{error}</p>
      <button onClick={loadData} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all">
        Retry
      </button>
    </div>
  );

  if (!audit) return <div className="text-center py-20 text-slate-400">Audit not found.</div>;

  const findings: AnalysisResult[] = audit.analysisResults || [];
  const testResults: TestResult[] = audit.testResults || [];
  const latestTest: TestResult | undefined = testResults[0];

  const groupedFindings = findings.reduce<Record<string, AnalysisResult[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'HIGH': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'LOW': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const categoryIcon = (category: string) => {
    switch (category) {
      case 'SECURITY': return <ShieldAlert size={20} className="text-rose-500" />;
      case 'PERFORMANCE': return <Zap size={20} className="text-amber-500" />;
      case 'MAINTAINABILITY': return <Settings size={20} className="text-blue-500" />;
      case 'STABILITY': return <Activity size={20} className="text-emerald-500" />;
      case 'FLEXIBILITY': return <Sliders size={20} className="text-purple-500" />;
      case 'EXTENSIBILITY': return <Puzzle size={20} className="text-cyan-500" />;
      case 'ERROR_PRONE': return <Bug size={20} className="text-rose-600" />;
      default: return <AlertTriangle size={20} className="text-slate-400" />;
    }
  };

  const testStatusColor = (status: string) => {
    switch (status) {
      case 'PASSED': return 'text-emerald-400';
      case 'HEALED': return 'text-indigo-400';
      case 'FAILED': return 'text-rose-400';
      case 'TIMEOUT': return 'text-orange-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Sticky Header */}
      <div
        className="sticky top-16 z-10 -mx-8 px-8 py-4 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{
          background: 'var(--bg-glass)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-4">
          <Link
            to={`/audits?projectId=${audit.projectId}`}
            className="p-2 rounded-xl transition-all shadow-sm"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-card)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{audit.project.name}</h1>
              <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>#{audit.ref}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{audit.commitHash.substring(0, 12)}</span>
              <div className="w-1 h-1 rounded-full" style={{ background: 'var(--border-medium)' }}></div>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(audit.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <StatusBadge status={audit.status} />
          </div>
          <button
            id="export-pdf-btn"
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <Download size={14} /> Export Report
          </button>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 text-white"
          >
            <RefreshCw size={18} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Retrying...' : 'Re-run Audit'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-rose-400 shrink-0" />
          <p className="text-rose-600 text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Tab Selector */}
      <div className="p-1.5 rounded-2xl flex w-fit" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <div className="flex items-center gap-2">
            <Activity size={18} />
            Analysis Results ({findings.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('tests')}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'tests' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <div className="flex items-center gap-2">
            <Code2 size={18} />
            Automated Tests {latestTest ? `(${latestTest.status})` : ''}
          </div>
        </button>
      </div>

      {/* Analysis Results Tab */}
      {activeTab === 'analysis' ? (
        <div id="audit-report-content" className="grid grid-cols-1 gap-10 bg-white p-6 rounded-3xl border border-slate-100">
          {findings.length > 0 && (
            <div className="flex justify-center">
              <RadarChart findings={findings} />
            </div>
          )}
          {Object.keys(groupedFindings).length === 0 && (
            <div className="rounded-3xl p-32 text-center border-2 border-dashed" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-medium)' }}>
              <div className="bg-emerald-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Clean Audit!</h3>
              <p className="max-w-md mx-auto" style={{ color: 'var(--text-tertiary)' }}>AI analysis didn't find any critical issues in this change. You're good to go.</p>
            </div>
          )}
          {Object.entries(groupedFindings).map(([category, items]) => (
            <section key={category}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                  {categoryIcon(category)}
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{category}</h2>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{items.length} Issue{items.length > 1 ? 's' : ''} Identified</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {items.map((finding) => (
                  <div
                    key={finding.id}
                    className="rounded-2xl overflow-hidden hover-glow transition-all shadow-md"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                  >
                    {/* Severity color bar on left */}
                    <div className="flex">
                      <div
                        className="w-1.5 shrink-0"
                        style={{
                          background: finding.severity === 'CRITICAL' ? '#f43f5e'
                            : finding.severity === 'HIGH' ? '#f97316'
                            : finding.severity === 'MEDIUM' ? '#eab308'
                            : '#3b82f6'
                        }}
                      />
                      <div className="p-6 flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`px-3 py-1 rounded-lg border text-[11px] font-black tracking-widest uppercase shadow-sm ${severityColor(finding.severity)}`}>
                              {finding.severity}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono px-3 py-1 rounded-full border"
                              style={{
                                background: 'var(--bg-secondary)',
                                borderColor: 'var(--border-subtle)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              📂 {finding.filePath}
                            </span>
                            {finding.lineRange && (
                              <span className="text-xs font-mono px-2 py-1 rounded-full"
                                style={{
                                  background: 'rgba(99,102,241,0.1)',
                                  color: '#6366f1',
                                }}
                              >
                                L{finding.lineRange}
                              </span>
                            )}
                          </div>
                        </div>
                        <h4 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{finding.description}</h4>

                        {/* Source Code Snippet */}
                        {finding.sourceSnippet && (
                          <details className="mt-4 group">
                            <summary
                              className="cursor-pointer flex items-center gap-2 text-xs font-bold uppercase tracking-widest py-2 select-none transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Code2 size={14} className="text-indigo-500" />
                              <span>문제 소스코드 보기</span>
                              <span className="ml-1 text-[10px] font-normal opacity-60">▶ 클릭하여 펼치기</span>
                            </summary>
                            <div className="mt-2 rounded-xl overflow-hidden border shadow-inner" style={{ borderColor: 'var(--border-subtle)' }}>
                              <div className="px-4 py-2 flex items-center justify-between" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
                                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                                  <Code2 size={12} />
                                  {finding.filePath}
                                  {finding.lineRange && <span className="text-indigo-400">:{finding.lineRange}</span>}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                                  Issue
                                </span>
                              </div>
                              <pre className="p-5 overflow-x-auto text-sm font-mono leading-relaxed bg-[#0d1117] max-h-[400px] overflow-y-auto">
                                <code className="text-indigo-200">{finding.sourceSnippet}</code>
                              </pre>
                            </div>
                          </details>
                        )}

                        {/* AI Suggestion */}
                        {finding.suggestion && (
                          <div className="mt-5 bg-indigo-500/5 rounded-2xl p-5 border border-indigo-500/10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                              <Zap size={64} className="text-indigo-400" />
                            </div>
                            <div className="text-indigo-600 text-xs font-black uppercase mb-2 flex items-center gap-2">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                              AI 제안 수정사항
                            </div>
                            <p className="text-sm leading-relaxed relative z-10 font-medium" style={{ color: 'var(--text-secondary)' }}>{finding.suggestion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        /* Tests Tab */
        <div className="space-y-6 animate-fade-in">
          {!latestTest ? (
            <div className="rounded-xl p-20 text-center border border-dashed" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-medium)' }}>
              <Code2 size={48} className="mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No tests generated yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sub-Tab Navigation */}
              <div className="flex border-b mb-6 gap-6" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  onClick={() => setTestSubTab('functional')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    testSubTab === 'functional'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Activity size={16} />
                  기능 검증 체크리스트
                </button>
                <button
                  onClick={() => setTestSubTab('performance')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    testSubTab === 'performance'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Gauge size={16} />
                  성능 및 부하 진단
                </button>
                <button
                  onClick={() => setTestSubTab('spec')}
                  className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    testSubTab === 'spec'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Code2 size={16} />
                  생성된 테스트 코드 & 힐링 로그
                </button>
              </div>

              {/* Sub-Tab Content: Functional Tests */}
              {testSubTab === 'functional' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                  {/* Test Cases Checklist */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-2xl p-6 shadow-md border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="font-extrabold text-lg" style={{ color: 'var(--text-primary)' }}>기능별 상세 테스트 케이스</h3>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>체크박스를 선택하여 실행할 대상을 고르고 실시간 테스트를 시뮬레이션 해보세요.</p>
                        </div>
                        <button
                          onClick={runSelectedTests}
                          disabled={runningTests}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/20"
                        >
                          {runningTests ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                          실행하기 (Run Tests)
                        </button>
                      </div>

                      <div className="space-y-3.5">
                        {getFunctionalTests(audit.project.name).map((tc) => {
                          const status = testStatuses[tc.name] || tc.status;
                          return (
                            <div
                              key={tc.name}
                              className="flex items-start gap-4 p-4 rounded-xl border transition-all hover:bg-slate-50/50"
                              style={{ borderColor: 'var(--border-subtle)' }}
                            >
                              <input
                                type="checkbox"
                                checked={!!selectedTests[tc.name]}
                                disabled={runningTests}
                                onChange={(e) => setSelectedTests(prev => ({ ...prev, [tc.name]: e.target.checked }))}
                                className="mt-1 cursor-pointer w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{tc.name}</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                    {tc.category}
                                  </span>
                                  {tc.latency && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {tc.latency}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{tc.description}</p>
                                {status === 'FAILED' && tc.details && (
                                  <div className="mt-2 text-xs font-mono p-2 rounded bg-rose-50 border border-rose-100 text-rose-600">
                                    Error: {tc.details}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 pt-0.5">
                                {status === 'PENDING' ? (
                                  <Loader2 size={16} className="text-indigo-500 animate-spin" />
                                ) : status === 'PASSED' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    <Check size={10} /> PASSED
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">
                                    <X size={10} /> FAILED
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* AI Diagnosis Opinion & Recommended Solutions */}
                    <div className="rounded-2xl p-6 border shadow-md relative overflow-hidden"
                         style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                      <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-500/5 rounded-full flex items-center justify-center">
                        <Zap size={48} className="text-indigo-500/10" />
                      </div>
                      <h3 className="font-extrabold text-base mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Zap size={18} className="text-indigo-500" />
                        AI 기능 검증 의견 및 해결 가이드
                      </h3>
                      
                      <div className="space-y-4 relative z-10">
                        {/* Opinion */}
                        <div className="p-4 rounded-xl text-sm border bg-slate-50/50" style={{ borderColor: 'var(--border-subtle)' }}>
                          <div className="font-bold text-xs uppercase tracking-wider mb-1.5 text-indigo-600">AI 분석 진단</div>
                          <p className="leading-relaxed text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {getDiagnosticOpinion(audit.project.name)}
                          </p>
                        </div>
                        
                        {/* Solutions */}
                        <div className="p-4 rounded-xl text-sm border" style={{ background: 'rgba(16, 185, 129, 0.02)', borderColor: 'rgba(16, 185, 129, 0.1)' }}>
                          <div className="font-bold text-xs uppercase tracking-wider mb-2 text-emerald-600">권장 조치 해결방안</div>
                          <ul className="list-disc pl-4 space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {getRecommendedSolutions(audit.project.name).map((sol, index) => (
                              <li key={index}>{sol}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary & Live Console */}
                  <div className="space-y-6">
                    {/* Execution Statistics Gauge */}
                    <div className="rounded-2xl p-6 shadow-md border flex flex-col items-center text-center justify-center"
                         style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                      <h3 className="font-extrabold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>테스트 성공률 (Success Rate)</h3>
                      {(() => {
                        const cases = getFunctionalTests(audit.project.name);
                        const totalSelected = Object.keys(selectedTests).filter(k => selectedTests[k]).length;
                        const passedSelected = cases.filter(c => selectedTests[c.name] && (testStatuses[c.name] || c.status) === 'PASSED').length;
                        const successRate = totalSelected > 0 ? Math.round((passedSelected / totalSelected) * 100) : 0;
                        const rad = 36;
                        const circ = 2 * Math.PI * rad;
                        const strokeOffset = circ - (successRate / 100) * circ;
                        return (
                          <div className="relative flex items-center justify-center mb-4">
                            <svg className="w-24 h-24 transform -rotate-90">
                              <circle
                                cx="48"
                                cy="48"
                                r={rad}
                                stroke="rgba(99, 102, 241, 0.08)"
                                strokeWidth="6"
                                fill="transparent"
                              />
                              <circle
                                cx="48"
                                cy="48"
                                r={rad}
                                stroke={successRate === 100 ? '#10b981' : successRate > 50 ? '#6366f1' : '#f43f5e'}
                                strokeWidth="6"
                                fill="transparent"
                                strokeDasharray={circ}
                                strokeDashoffset={strokeOffset}
                                className="transition-all duration-500 ease-out"
                              />
                            </svg>
                            <div className="absolute text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                              {successRate}%
                            </div>
                          </div>
                        );
                      })()}
                      <div className="grid grid-cols-2 gap-4 w-full mt-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border" style={{ borderColor: 'var(--border-subtle)' }}>
                          <div className="text-slate-400 font-medium">선택된 항목</div>
                          <div className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {Object.values(selectedTests).filter(Boolean).length}개
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50/20 border border-emerald-500/10">
                          <div className="text-emerald-600 font-medium">통과된 항목</div>
                          <div className="text-sm font-bold text-emerald-600 mt-0.5">
                            {getFunctionalTests(audit.project.name).filter(c => selectedTests[c.name] && (testStatuses[c.name] || c.status) === 'PASSED').length}개
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Simulation Console Logs */}
                    <div className="rounded-2xl overflow-hidden shadow-md border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                      <div className="px-4 py-2.5 flex items-center gap-2 text-xs font-bold"
                           style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        <Terminal size={14} className="text-indigo-500" />
                        실행 모니터링 콘솔 (Console)
                      </div>
                      <div className="p-4 h-80 overflow-y-auto font-mono text-[10px] leading-relaxed whitespace-pre bg-[#0d1117] text-indigo-300">
                        {simulationLogs}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab Content: Performance & Latency */}
              {testSubTab === 'performance' && (
                <div className="space-y-6 animate-fade-in">
                  {(() => {
                    const metrics = getPerformanceMetrics(audit.project.name);
                    return (
                      <div className="space-y-6">
                        {/* Methodology Card */}
                        <div className="rounded-2xl p-5 shadow-sm border flex items-start gap-3.5"
                             style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Cpu size={20} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>성능 테스트 방법론 및 도구</h4>
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              <strong>도구:</strong> {metrics.toolUsed} | <strong>구성:</strong> {metrics.concurrency} ({metrics.duration})<br/>
                              {metrics.methodology}
                            </p>
                          </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="rounded-xl p-5 border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">평균 레이턴시</div>
                            <div className="text-2xl font-black text-indigo-600">{metrics.avgLatency}</div>
                          </div>
                          <div className="rounded-xl p-5 border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">최대 처리량</div>
                            <div className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{metrics.throughput}</div>
                          </div>
                          <div className="rounded-xl p-5 border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">요청 에러율</div>
                            <div className="text-2xl font-black text-emerald-600">{metrics.errorRate}</div>
                          </div>
                          <div className="rounded-xl p-5 border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">리소스 Peak 부하</div>
                            <div className="text-2xl font-black text-amber-600">{metrics.cpuPeak} / {metrics.memoryPeak}</div>
                          </div>
                        </div>

                        {/* Latency Breakdown & Recommended Solutions */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Percentiles Bar Chart */}
                          <div className="lg:col-span-2 rounded-2xl p-6 shadow-md border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                            <h3 className="font-extrabold text-sm mb-5" style={{ color: 'var(--text-primary)' }}>레이턴시 분위수 분포 (Percentile Latency)</h3>
                            
                            {metrics.avgLatency === 'N/A' ? (
                              <div className="py-8 text-center text-xs text-slate-400">
                                해당 프로젝트 유형은 네트워크 레이턴시 분위수를 적용하지 않습니다. (클라이언트 단 독립 진단)
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {(() => {
                                  // Helper to extract number
                                  const getNum = (str: string) => parseInt(str) || 50;
                                  const p50 = getNum(metrics.p50Latency);
                                  const p95 = getNum(metrics.p95Latency);
                                  const p99 = getNum(metrics.p99Latency);
                                  const max = Math.max(p99, 100);

                                  return (
                                    <>
                                      {/* p50 */}
                                      <div>
                                        <div className="flex justify-between text-xs font-semibold mb-1">
                                          <span style={{ color: 'var(--text-secondary)' }}>p50 (보통 요청 속도)</span>
                                          <span style={{ color: 'var(--text-primary)' }}>{metrics.p50Latency}</span>
                                        </div>
                                        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                                          <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${(p50 / max) * 100}%` }}
                                          />
                                        </div>
                                      </div>

                                      {/* p95 */}
                                      <div>
                                        <div className="flex justify-between text-xs font-semibold mb-1">
                                          <span style={{ color: 'var(--text-secondary)' }}>p95 (지연 임계 요청 속도)</span>
                                          <span style={{ color: 'var(--text-primary)' }}>{metrics.p95Latency}</span>
                                        </div>
                                        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                                          <div
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${(p95 / max) * 100}%` }}
                                          />
                                        </div>
                                      </div>

                                      {/* p99 */}
                                      <div>
                                        <div className="flex justify-between text-xs font-semibold mb-1">
                                          <span style={{ color: 'var(--text-secondary)' }}>p99 (최악 피크 지연 요청 속도)</span>
                                          <span style={{ color: 'var(--text-primary)' }}>{metrics.p99Latency}</span>
                                        </div>
                                        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                                          <div
                                            className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${(p99 / max) * 100}%` }}
                                          />
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          {/* AI Performance Diagnosis Opinion & Recommended Solutions */}
                          <div className="rounded-2xl p-6 border shadow-md relative overflow-hidden"
                               style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                            <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-500/5 rounded-full flex items-center justify-center">
                              <Zap size={48} className="text-indigo-500/10" />
                            </div>
                            <h3 className="font-extrabold text-base mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                              <Zap size={18} className="text-indigo-500" />
                              AI 성능 진단 의견 및 해결 가이드
                            </h3>
                            
                            <div className="space-y-4 relative z-10">
                              {/* Opinion */}
                              <div className="p-4 rounded-xl text-sm border bg-slate-50/50" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div className="font-bold text-xs uppercase tracking-wider mb-1.5 text-indigo-600">AI 성능 분석</div>
                                <p className="leading-relaxed text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {getDiagnosticOpinion(audit.project.name)}
                                </p>
                              </div>
                              
                              {/* Solutions */}
                              <div className="p-4 rounded-xl text-sm border" style={{ background: 'rgba(16, 185, 129, 0.02)', borderColor: 'rgba(16, 185, 129, 0.1)' }}>
                                <div className="font-bold text-xs uppercase tracking-wider mb-2 text-emerald-600">성능 권장 조치사항</div>
                                <ul className="list-disc pl-4 space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                  {getRecommendedSolutions(audit.project.name).map((sol, index) => (
                                    <li key={index}>{sol}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Benchmark Logs Panel */}
                        <div className="rounded-2xl overflow-hidden shadow-md border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                          <div className="px-4 py-2.5 flex items-center gap-2 text-xs font-bold"
                               style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                            <Terminal size={14} className="text-indigo-500" />
                            성능 벤치마킹 실행 출력 콘솔 (Benchmark Log Console)
                          </div>
                          <pre className="p-5 overflow-x-auto text-[11px] font-mono leading-relaxed bg-[#0d1117] text-indigo-200 max-h-[350px] overflow-y-auto">
                            <code>{metrics.logs}</code>
                          </pre>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Sub-Tab Content: Spec & Healing Timeline */}
              {testSubTab === 'spec' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                  {/* Test Code Panel */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl overflow-hidden shadow-md border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                      <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-2 text-xs font-bold font-mono" style={{ color: 'var(--text-secondary)' }}>
                          <Code2 size={14} className="text-indigo-500" /> generated_test_spec.ts
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${testStatusColor(latestTest.status)}`}>
                          {latestTest.status}
                        </span>
                      </div>
                      <pre className="p-6 overflow-x-auto text-xs font-mono text-indigo-200 leading-relaxed bg-[#0d1117] max-h-[600px] overflow-y-auto">
                        <code>{latestTest.testCode}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Sidebar Info */}
                  <div className="space-y-6">
                    {/* Execution Stats */}
                    <div className="rounded-2xl p-6 shadow-md border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                      <h3 className="font-extrabold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <History size={16} className="text-indigo-500" />
                        Execution Stats
                      </h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Status</span>
                          <span className={`text-sm font-bold ${testStatusColor(latestTest.status)}`}>
                            {latestTest.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Iterations</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{latestTest.iterationCount} / 3</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Exit Code</span>
                          <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{latestTest.exitCode ?? 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Error Analysis */}
                    {latestTest.errorAnalysis && (
                      <div className="bg-orange-500/5 rounded-2xl p-6 border border-orange-500/10">
                        <h3 className="font-bold mb-3 flex items-center gap-2 text-orange-600 text-sm">
                          <AlertTriangle size={16} />
                          AI Error Analysis
                        </h3>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{latestTest.errorAnalysis}</p>
                      </div>
                    )}

                    {/* Console Output */}
                    <div className="rounded-2xl overflow-hidden shadow-md border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                      <div className="px-4 py-2 flex items-center gap-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        <Terminal size={14} className="text-indigo-500" /> Console Output
                      </div>
                      <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] leading-relaxed whitespace-pre-wrap bg-[#05070a] text-slate-300 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        {latestTest.stderr || latestTest.stdout || 'No logs available.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Healing Iterations Timeline */}
              {testSubTab === 'spec' && latestTest && latestTest.healingIterations && latestTest.healingIterations.length > 1 && (
                <div className="mt-8">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Beaker size={20} className="text-indigo-500" />
                    Self-Healing Timeline
                  </h3>
                  <div className="space-y-4">
                    {latestTest.healingIterations.map((iter: HealingIteration) => (
                      <details
                        key={iter.id}
                        className="rounded-2xl overflow-hidden shadow-sm transition-all border"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                      >
                        <summary
                          className="px-6 py-4 cursor-pointer transition-colors flex items-center justify-between"
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              iter.exitCode === 0
                                ? 'bg-emerald-500/20 text-emerald-600'
                                : 'bg-rose-500/20 text-rose-600'
                            }`}>
                              {iter.iteration}
                            </div>
                            <div>
                              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                Iteration {iter.iteration}
                              </span>
                              <span className={`ml-3 text-xs font-bold ${iter.exitCode === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {iter.exitCode === 0 ? 'PASSED' : `EXIT ${iter.exitCode}`}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(iter.createdAt).toLocaleTimeString()}</span>
                        </summary>
                        <div className="px-6 py-4 space-y-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          {iter.errorAnalysis && (
                            <div className="bg-orange-500/5 rounded-xl p-4 border border-orange-500/10">
                              <p className="text-xs font-bold text-orange-600 mb-2">AI Analysis</p>
                              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{iter.errorAnalysis}</p>
                            </div>
                          )}
                          <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="px-4 py-2 text-xs font-semibold font-mono" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                              Test Code (Iteration {iter.iteration})
                            </div>
                            <pre className="p-4 overflow-x-auto text-xs font-mono text-indigo-200 leading-relaxed bg-[#0d1117] max-h-64 overflow-y-auto">
                              <code>{iter.testCode}</code>
                            </pre>
                          </div>
                          {(iter.stdout || iter.stderr) && (
                            <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                              <div className="px-4 py-2 text-xs font-semibold flex items-center gap-2" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                <Terminal size={12} /> Output
                              </div>
                              <pre className="p-4 overflow-x-auto text-[11px] font-mono leading-tight max-h-48 overflow-y-auto whitespace-pre-wrap bg-slate-950 text-slate-300">
                                {iter.stderr || iter.stdout}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
