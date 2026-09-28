import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { simulateDeployment } from '../services/api';
import { RiskIndicator } from '../components/RiskIndicator';
import { PlayCircle, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';

export const SimulateDeployment: React.FC = () => {
  const navigate = useNavigate();
  const [serviceName, setServiceName] = useState<string>('payment-api');
  const [environment, setEnvironment] = useState<string>('production');
  const [changeType, setChangeType] = useState<string>('database_config');
  const [failDeployment, setFailDeployment] = useState<boolean>(true);
  const [author, setAuthor] = useState<string>('alex.dev');

  const [loading, setLoading] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setSimulationResult(null);
      const res = await simulateDeployment({
        service_name: serviceName,
        environment,
        change_type: changeType,
        fail_deployment: failDeployment,
        author
      });
      setSimulationResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <PlayCircle className="w-6 h-6 text-blue-600" />
          Simulate Release
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Trigger simulated deployments with custom change signatures to test risk evaluation.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <form onSubmit={handleSimulate} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Service</label>
              <select
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="payment-api">payment-api</option>
                <option value="user-service">user-service</option>
                <option value="order-service">order-service</option>
                <option value="notification-service">notification-service</option>
                <option value="inventory-service">inventory-service</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="production">production</option>
                <option value="staging">staging</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Change Signature Type</label>
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="database_config">Database Config</option>
                <option value="auth_env">Auth Env Var</option>
                <option value="dependency_upgrade">Dependency Upgrade</option>
                <option value="clean_code">Clean Code Patch</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Deployment Outcome</label>
              <select
                value={failDeployment ? 'fail' : 'success'}
                onChange={(e) => setFailDeployment(e.target.value === 'fail')}
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="fail">Fail Deployment (Trigger Incident)</option>
                <option value="success">Healthy Deployment</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end border-t border-gray-100">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  <span>Simulate Release Rollout</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {simulationResult && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">
              Simulation Results
            </h3>
            <span className="text-xs font-mono text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
              Release #{simulationResult.deployment.deployment_number}
            </span>
          </div>

          <div className="p-6 space-y-6">
            <RiskIndicator
              riskLevel={simulationResult.risk_evaluation.risk_level}
              riskReason={simulationResult.risk_evaluation.reason}
            />

            {simulationResult.incident && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-red-900">
                      {simulationResult.incident.incident_code} Triggered
                    </span>
                    <span className="text-xs font-mono text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                      FP: {simulationResult.incident.failure_fingerprint}
                    </span>
                  </div>
                  <p className="text-sm text-red-800 ml-7">{simulationResult.incident.title}</p>
                </div>

                <button
                  onClick={() => navigate(`/incidents/${simulationResult.incident.id}`)}
                  className="px-4 py-2 rounded-md bg-white border border-red-200 hover:bg-red-50 text-red-700 font-medium flex items-center gap-2 transition-colors text-sm shadow-sm"
                >
                  <span>Investigate</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
