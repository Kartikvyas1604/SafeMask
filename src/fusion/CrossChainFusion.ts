import { ethers } from 'ethers';
import oneInchAggregator from '../dex/OneInchAggregator';
import wormholeBridge from '../bridge/WormholeBridge';
import * as logger from '../utils/logger';

export interface Intent {
  id: string;
  user: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  minOutputAmount: string;
  inputChain: number;
  outputChain: number;
  deadline: number;
  recipient?: string;
  status: IntentStatus;
  createdAt: number;
}

export enum IntentStatus {
  Created = 'created',
  FindingSolutions = 'finding_solutions',
  SolutionsFound = 'solutions_found',
  Executing = 'executing',
  Completed = 'completed',
  Failed = 'failed',
  Expired = 'expired',
}

interface ExecutionStep {
  stepType: StepType;
  chain: number;
  protocol: string;
  inputToken: string;
  outputToken: string;
  estimatedInput: string;
  estimatedOutput: string;
  gasEstimate: string;
}

enum StepType {
  Swap = 'swap',
  Bridge = 'bridge',
  Wrap = 'wrap',
  Unwrap = 'unwrap',
}

interface Solution {
  id: string;
  intentId: string;
  solver: string;
  steps: ExecutionStep[];
  estimatedOutput: string;
  totalGasCost: string;
  executionTime: number;
  confidence: number;
  createdAt: number;
}

interface ExecutionResult {
  intentId: string;
  solutionId: string;
  success: boolean;
  actualOutput?: string;
  executedSteps: ExecutedStep[];
  totalGasUsed?: string;
  error?: string;
}

interface ExecutedStep {
  stepNumber: number;
  txHash: string;
  gasUsed: string;
  actualOutput: string;
  timestamp: number;
}

export class CrossChainFusionEngine {
  private static instance: CrossChainFusionEngine;
  
  private intents: Map<string, Intent> = new Map();
  private solutions: Map<string, Solution[]> = new Map();
  private executions: Map<string, ExecutionResult> = new Map();
  
  private constructor() {}

  public static getInstance(): CrossChainFusionEngine {
    if (!CrossChainFusionEngine.instance) {
      CrossChainFusionEngine.instance = new CrossChainFusionEngine();
    }
    return CrossChainFusionEngine.instance;
  }

  public async createIntent(
    inputToken: string,
    outputToken: string,
    inputAmount: string,
    minOutputAmount: string,
    inputChain: number,
    outputChain: number,
    user: string,
    options?: {
      deadline?: number;
      recipient?: string;
    }
  ): Promise<string> {
    const intentId = this.generateIntentId();
    
    logger.info(`Creating intent ${intentId}`);
    logger.info(`Input: ${inputAmount} ${inputToken} on chain ${inputChain}`);
    logger.info(`Output: ${outputToken} on chain ${outputChain}`);

    const intent: Intent = {
      id: intentId,
      user,
      inputToken,
      outputToken,
      inputAmount,
      minOutputAmount,
      inputChain,
      outputChain,
      deadline: options?.deadline || Date.now() + 300000,
      recipient: options?.recipient,
      status: IntentStatus.Created,
      createdAt: Date.now(),
    };

    this.intents.set(intentId, intent);

    await this.findSolutions(intentId);

    return intentId;
  }

  public async findSolutions(intentId: string): Promise<Solution[]> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent ${intentId} not found`);
    }

    logger.info(`Finding solutions for intent ${intentId}`);
    intent.status = IntentStatus.FindingSolutions;

    const solutions: Solution[] = [];

    if (intent.inputChain === intent.outputChain) {
      const sameChainSolution = await this.findSameChainSolution(intent);
      if (sameChainSolution) {
        solutions.push(sameChainSolution);
      }
    } else {
      const bridgeSolutions = await this.findBridgeSolutions(intent);
      solutions.push(...bridgeSolutions);
    }

    this.solutions.set(intentId, solutions);
    intent.status = IntentStatus.SolutionsFound;

    logger.info(`Found ${solutions.length} solutions for intent ${intentId}`);

    return solutions;
  }

  private async findSameChainSolution(intent: Intent): Promise<Solution | null> {
    try {
      const quote = await oneInchAggregator.getQuote(
        intent.inputChain,
        intent.inputToken,
        intent.outputToken,
        intent.inputAmount,
        {
          slippage: 1,
          includeGas: true,
        }
      );

      const steps: ExecutionStep[] = [
        {
          stepType: StepType.Swap,
          chain: intent.inputChain,
          protocol: '1inch',
          inputToken: intent.inputToken,
          outputToken: intent.outputToken,
          estimatedInput: intent.inputAmount,
          estimatedOutput: quote.toTokenAmount,
          gasEstimate: quote.estimatedGas.toString(),
        },
      ];

      const solution: Solution = {
        id: this.generateSolutionId(),
        intentId: intent.id,
        solver: 'SafeMask-solver',
        steps,
        estimatedOutput: quote.toTokenAmount,
        totalGasCost: quote.estimatedGas.toString(),
        executionTime: 30,
        confidence: 0.95,
        createdAt: Date.now(),
      };

      return solution;
    } catch (error) {
      logger.error('Failed to find same-chain solution:', error);
      return null;
    }
  }

  private async findBridgeSolutions(intent: Intent): Promise<Solution[]> {
    const solutions: Solution[] = [];

    const directBridgeSolution = await this.findDirectBridgeSolution(intent);
    if (directBridgeSolution) {
      solutions.push(directBridgeSolution);
    }

    const swapBridgeSwapSolution = await this.findSwapBridgeSwapSolution(intent);
    if (swapBridgeSwapSolution) {
      solutions.push(swapBridgeSwapSolution);
    }

    return solutions;
  }

  private async findDirectBridgeSolution(intent: Intent): Promise<Solution | null> {
    try {
      logger.info('Finding direct bridge solution');

      const steps: ExecutionStep[] = [
        {
          stepType: StepType.Bridge,
          chain: intent.inputChain,
          protocol: 'wormhole',
          inputToken: intent.inputToken,
          outputToken: intent.outputToken,
          estimatedInput: intent.inputAmount,
          estimatedOutput: intent.inputAmount,
          gasEstimate: '200000',
        },
      ];

      const solution: Solution = {
        id: this.generateSolutionId(),
        intentId: intent.id,
        solver: 'SafeMask-solver',
        steps,
        estimatedOutput: intent.inputAmount,
        totalGasCost: '200000',
        executionTime: 300,
        confidence: 0.90,
        createdAt: Date.now(),
      };

      return solution;
    } catch (error) {
      logger.error('Failed to find direct bridge solution:', error);
      return null;
    }
  }

  private async findSwapBridgeSwapSolution(intent: Intent): Promise<Solution | null> {
    try {
      logger.info('Finding swap-bridge-swap solution');

      const stableTokens: Record<number, string> = {
        1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      };

      const sourceStable = stableTokens[intent.inputChain];
      const targetStable = stableTokens[intent.outputChain];

      if (!sourceStable || !targetStable) {
        return null;
      }

      const steps: ExecutionStep[] = [];

      const swapToStable = await oneInchAggregator.getQuote(
        intent.inputChain,
        intent.inputToken,
        sourceStable,
        intent.inputAmount,
        { includeGas: true }
      );

      steps.push({
        stepType: StepType.Swap,
        chain: intent.inputChain,
        protocol: '1inch',
        inputToken: intent.inputToken,
        outputToken: sourceStable,
        estimatedInput: intent.inputAmount,
        estimatedOutput: swapToStable.toTokenAmount,
        gasEstimate: swapToStable.estimatedGas.toString(),
      });

      steps.push({
        stepType: StepType.Bridge,
        chain: intent.inputChain,
        protocol: 'wormhole',
        inputToken: sourceStable,
        outputToken: targetStable,
        estimatedInput: swapToStable.toTokenAmount,
        estimatedOutput: swapToStable.toTokenAmount,
        gasEstimate: '200000',
      });

      const swapFromStable = await oneInchAggregator.getQuote(
        intent.outputChain,
        targetStable,
        intent.outputToken,
        swapToStable.toTokenAmount,
        { includeGas: true }
      );

      steps.push({
        stepType: StepType.Swap,
        chain: intent.outputChain,
        protocol: '1inch',
        inputToken: targetStable,
        outputToken: intent.outputToken,
        estimatedInput: swapToStable.toTokenAmount,
        estimatedOutput: swapFromStable.toTokenAmount,
        gasEstimate: swapFromStable.estimatedGas.toString(),
      });

      const totalGas = steps.reduce(
        (sum, step) => sum + BigInt(step.gasEstimate),
        BigInt(0)
      );

      const solution: Solution = {
        id: this.generateSolutionId(),
        intentId: intent.id,
        solver: 'SafeMask-solver',
        steps,
        estimatedOutput: swapFromStable.toTokenAmount,
        totalGasCost: totalGas.toString(),
        executionTime: 360,
        confidence: 0.85,
        createdAt: Date.now(),
      };

      return solution;
    } catch (error) {
      logger.error('Failed to find swap-bridge-swap solution:', error);
      return null;
    }
  }

  public async executeIntent(
    intentId: string,
    solutionId: string,
    wallet: ethers.Wallet
  ): Promise<ExecutionResult> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent ${intentId} not found`);
    }

    const solutions = this.solutions.get(intentId);
    const solution = solutions?.find(s => s.id === solutionId);
    if (!solution) {
      throw new Error(`Solution ${solutionId} not found`);
    }

    logger.info(`Executing intent ${intentId} with solution ${solutionId}`);
    intent.status = IntentStatus.Executing;

    const executedSteps: ExecutedStep[] = [];
    let currentAmount = intent.inputAmount;

    try {
      for (let i = 0; i < solution.steps.length; i++) {
        const step = solution.steps[i];
        logger.info(`Executing step ${i + 1}/${solution.steps.length}: ${step.stepType}`);

        const executedStep = await this.executeStep(step, currentAmount, wallet);
        executedSteps.push(executedStep);
        currentAmount = executedStep.actualOutput;
      }

      intent.status = IntentStatus.Completed;

      const result: ExecutionResult = {
        intentId,
        solutionId,
        success: true,
        actualOutput: currentAmount,
        executedSteps,
        totalGasUsed: executedSteps.reduce(
          (sum, step) => (BigInt(sum) + BigInt(step.gasUsed)).toString(),
          '0'
        ),
      };

      this.executions.set(intentId, result);
      logger.info(`Intent ${intentId} executed successfully`);

      return result;
    } catch (error: any) {
      logger.error(`Intent execution failed:`, error);
      intent.status = IntentStatus.Failed;

      const result: ExecutionResult = {
        intentId,
        solutionId,
        success: false,
        executedSteps,
        error: error.message,
      };

      this.executions.set(intentId, result);
      return result;
    }
  }

  private async executeStep(
    step: ExecutionStep,
    amount: string,
    wallet: ethers.Wallet
  ): Promise<ExecutedStep> {
    const startTime = Date.now();

    switch (step.stepType) {
      case StepType.Swap:
        return await this.executeSwapStep(step, amount, wallet);
      case StepType.Bridge:
        return await this.executeBridgeStep(step, amount, wallet);
      default:
        throw new Error(`Unknown step type: ${step.stepType}`);
    }
  }

  private async executeSwapStep(
    step: ExecutionStep,
    amount: string,
    wallet: ethers.Wallet
  ): Promise<ExecutedStep> {
    logger.info(`Executing swap on chain ${step.chain}`);
    logger.info(`${step.inputToken} → ${step.outputToken}`);

    const result = await oneInchAggregator.executeSwap(
      step.chain,
      step.inputToken,
      step.outputToken,
      amount,
      wallet,
      { slippage: 1 }
    );

    return {
      stepNumber: 0,
      txHash: result.txHash,
      gasUsed: '0',
      actualOutput: result.outputAmount,
      timestamp: Date.now(),
    };
  }

  private async executeBridgeStep(
    step: ExecutionStep,
    amount: string,
    wallet: ethers.Wallet
  ): Promise<ExecutedStep> {
    logger.info(`Executing bridge from chain ${step.chain}`);
    logger.info(`Amount: ${amount}`);

    const targetChain = this.findTargetChain(step);

    const result = await wormholeBridge.bridgeTokens(
      step.chain,
      targetChain,
      step.inputToken,
      amount,
      await wallet.getAddress(),
      wallet
    );

    return {
      stepNumber: 0,
      txHash: result.lockTx,
      gasUsed: '0',
      actualOutput: amount,
      timestamp: Date.now(),
    };
  }

  private findTargetChain(step: ExecutionStep): number {
    return step.chain === 1 ? 137 : 1;
  }

  public getIntent(intentId: string): Intent | undefined {
    return this.intents.get(intentId);
  }

  public getSolutions(intentId: string): Solution[] | undefined {
    return this.solutions.get(intentId);
  }

  public getExecution(intentId: string): ExecutionResult | undefined {
    return this.executions.get(intentId);
  }

  public getBestSolution(intentId: string): Solution | undefined {
    const solutions = this.solutions.get(intentId);
    if (!solutions || solutions.length === 0) {
      return undefined;
    }

    return solutions.reduce((best, current) => {
      const bestScore = this.scoreSolution(best);
      const currentScore = this.scoreSolution(current);
      return currentScore > bestScore ? current : best;
    });
  }

  private scoreSolution(solution: Solution): number {
    const outputScore = Number(solution.estimatedOutput) / 1e18;
    const gasScore = -Number(solution.totalGasCost) / 1e6;
    const timeScore = -solution.executionTime / 60;
    const confidenceScore = solution.confidence * 1000;

    return outputScore + gasScore + timeScore + confidenceScore;
  }

  private generateIntentId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSolutionId(): string {
    return `solution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public async cleanupExpiredIntents(): Promise<void> {
    const now = Date.now();
    
    for (const [id, intent] of this.intents.entries()) {
      if (intent.deadline < now && intent.status !== IntentStatus.Completed) {
        intent.status = IntentStatus.Expired;
        logger.info(`Intent ${id} expired`);
      }
    }
  }
}

export default CrossChainFusionEngine.getInstance();
