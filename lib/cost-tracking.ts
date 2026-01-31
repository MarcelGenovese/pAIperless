import { prisma } from './prisma';
import { getConfig, CONFIG_KEYS } from './config';
import { createLogger } from './logger';
import { sendAPILimitReachedEmail, sendAPILimitWarningEmail } from './email';

const logger = createLogger('CostTracking');

// Track which warnings have been sent this month to avoid spam
const sentWarnings = new Map<string, Set<number>>(); // month -> Set of percentages sent

/**
 * Get current month in format YYYY-MM
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Check and send email notifications for API limits
 */
async function checkAndSendLimitNotifications(
  apiType: 'gemini' | 'documentai',
  currentUsage: number,
  limit: number,
  month: string
) {
  try {
    const percentage = (currentUsage / limit) * 100;
    const threshold = parseInt(await getConfig(CONFIG_KEYS.EMAIL_API_WARNING_THRESHOLD) || '80', 10);

    // Initialize warnings tracking for this month if needed
    if (!sentWarnings.has(month)) {
      sentWarnings.set(month, new Set());
    }
    const monthWarnings = sentWarnings.get(month)!;

    // Check if limit reached (100%)
    if (percentage >= 100 && !monthWarnings.has(100)) {
      await sendAPILimitReachedEmail(apiType, currentUsage, limit, month);
      monthWarnings.add(100);
      await logger.info(`Sent API limit reached email for ${apiType}`);
    }
    // Check if warning threshold reached
    else if (percentage >= threshold && !monthWarnings.has(threshold)) {
      await sendAPILimitWarningEmail(apiType, currentUsage, limit, percentage, month);
      monthWarnings.add(threshold);
      await logger.info(`Sent API limit warning email for ${apiType} at ${percentage.toFixed(1)}%`);
    }
  } catch (error: any) {
    await logger.error(`Failed to send limit notification for ${apiType}`, error);
  }
}

/**
 * Get or create cost tracking record for current month
 */
export async function getCurrentMonthTracking() {
  const month = getCurrentMonth();

  let tracking = await prisma.costTracking.findUnique({
    where: { month }
  });

  if (!tracking) {
    // Get limits from config
    const docAILimit = parseInt(await getConfig(CONFIG_KEYS.DOCUMENT_AI_MONTHLY_PAGE_LIMIT) || '5000', 10);
    const geminiLimit = parseInt(await getConfig(CONFIG_KEYS.GEMINI_MONTHLY_TOKEN_LIMIT) || '1000000', 10);

    tracking = await prisma.costTracking.create({
      data: {
        month,
        documentAIPagesLimit: docAILimit,
        geminiTokensLimit: geminiLimit,
      }
    });
    await logger.info(`Created cost tracking for month ${month}`, {
      docAILimit,
      geminiLimit
    });
  }

  return tracking;
}

/**
 * Check if we can process pages with Document AI
 * Returns false if limit would be exceeded
 */
export async function canProcessWithDocumentAI(pageCount: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const tracking = await getCurrentMonthTracking();

    const newTotal = tracking.documentAIPages + pageCount;

    if (newTotal > tracking.documentAIPagesLimit) {
      await logger.warn(`Document AI monthly limit would be exceeded`, {
        current: tracking.documentAIPages,
        limit: tracking.documentAIPagesLimit,
        requestedPages: pageCount,
        wouldBe: newTotal
      });
      return {
        allowed: false,
        reason: `Monthly Document AI page limit (${tracking.documentAIPagesLimit}) would be exceeded. Current: ${tracking.documentAIPages}, Requested: ${pageCount}`
      };
    }

    return { allowed: true };
  } catch (error: any) {
    await logger.error('Error checking Document AI limit', error);
    // In case of error, allow processing but log it
    return { allowed: true };
  }
}

/**
 * Reserve Document AI pages BEFORE processing
 * This ensures the limit is respected even if processing fails
 */
export async function reserveDocumentAIPages(pageCount: number): Promise<boolean> {
  try {
    const tracking = await getCurrentMonthTracking();

    const updated = await prisma.costTracking.update({
      where: { id: tracking.id },
      data: {
        documentAIPages: {
          increment: pageCount
        }
      }
    });

    await logger.info(`Reserved ${pageCount} Document AI pages`, {
      previous: tracking.documentAIPages,
      new: updated.documentAIPages,
      limit: tracking.documentAIPagesLimit
    });

    // Check and send email notifications
    await checkAndSendLimitNotifications(
      'documentai',
      updated.documentAIPages,
      tracking.documentAIPagesLimit,
      tracking.month
    );

    return true;
  } catch (error: any) {
    await logger.error('Error reserving Document AI pages', error);
    return false;
  }
}

/**
 * Estimate token count for text (rough approximation)
 * 1 token ≈ 4 characters for English text
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if we can process with Gemini
 * Estimated tokens are calculated from document text
 */
export async function canProcessWithGemini(estimatedInputTokens: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const tracking = await getCurrentMonthTracking();

    // Estimate output tokens (usually less than input, but we'll be conservative)
    const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.3);
    const totalEstimated = estimatedInputTokens + estimatedOutputTokens;

    const newTotal = tracking.geminiTokensSent + tracking.geminiTokensReceived + totalEstimated;

    if (newTotal > tracking.geminiTokensLimit) {
      await logger.warn(`Gemini monthly token limit would be exceeded`, {
        currentSent: tracking.geminiTokensSent,
        currentReceived: tracking.geminiTokensReceived,
        limit: tracking.geminiTokensLimit,
        estimatedTokens: totalEstimated,
        wouldBe: newTotal
      });
      return {
        allowed: false,
        reason: `Monthly Gemini token limit (${tracking.geminiTokensLimit}) would be exceeded. Current: ${tracking.geminiTokensSent + tracking.geminiTokensReceived}, Estimated: ${totalEstimated}`
      };
    }

    return { allowed: true };
  } catch (error: any) {
    await logger.error('Error checking Gemini limit', error);
    // In case of error, allow processing but log it
    return { allowed: true };
  }
}

/**
 * Reserve Gemini tokens BEFORE processing
 * This ensures the limit is respected even if processing fails
 */
export async function reserveGeminiTokens(inputText: string): Promise<{ reserved: boolean; estimatedTokens: number }> {
  try {
    const tracking = await getCurrentMonthTracking();
    const estimatedTokens = estimateTokenCount(inputText);
    const estimatedOutput = Math.ceil(estimatedTokens * 0.3);

    const updated = await prisma.costTracking.update({
      where: { id: tracking.id },
      data: {
        geminiTokensSent: {
          increment: estimatedTokens
        },
        geminiTokensReceived: {
          increment: estimatedOutput
        }
      }
    });

    await logger.info(`Reserved ~${estimatedTokens} Gemini tokens`, {
      previousSent: tracking.geminiTokensSent,
      newSent: updated.geminiTokensSent,
      previousReceived: tracking.geminiTokensReceived,
      newReceived: updated.geminiTokensReceived,
      limit: tracking.geminiTokensLimit
    });

    return { reserved: true, estimatedTokens };
  } catch (error: any) {
    await logger.error('Error reserving Gemini tokens', error);
    return { reserved: false, estimatedTokens: 0 };
  }
}

/**
 * Update actual token counts after Gemini response
 * Adjusts the estimates to actual values
 */
export async function updateActualGeminiTokens(documentId: number, actualSent: number, actualReceived: number): Promise<void> {
  try {
    // Get the document to find estimated tokens
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { geminiTokensSent: true, geminiTokensRecv: true }
    });

    if (!doc) {
      await logger.error(`Document ${documentId} not found for token update`);
      return;
    }

    const estimatedSent = doc.geminiTokensSent || 0;
    const estimatedReceived = doc.geminiTokensRecv || 0;

    // Calculate difference
    const diffSent = actualSent - estimatedSent;
    const diffReceived = actualReceived - estimatedReceived;

    // Update cost tracking
    const tracking = await getCurrentMonthTracking();
    const updated = await prisma.costTracking.update({
      where: { id: tracking.id },
      data: {
        geminiTokensSent: {
          increment: diffSent
        },
        geminiTokensReceived: {
          increment: diffReceived
        }
      }
    });

    // Update document record
    await prisma.document.update({
      where: { id: documentId },
      data: {
        geminiTokensSent: actualSent,
        geminiTokensRecv: actualReceived
      }
    });

    await logger.info(`Updated actual Gemini tokens for document ${documentId}`, {
      estimatedSent,
      actualSent,
      diffSent,
      estimatedReceived,
      actualReceived,
      diffReceived
    });

    // Check and send email notifications
    const totalTokens = updated.geminiTokensSent + updated.geminiTokensReceived;
    await checkAndSendLimitNotifications(
      'gemini',
      totalTokens,
      tracking.geminiTokensLimit,
      tracking.month
    );
  } catch (error: any) {
    await logger.error('Error updating actual Gemini tokens', error);
  }
}

/**
 * Get current month usage statistics
 */
export async function getMonthlyUsage() {
  const tracking = await getCurrentMonthTracking();

  // Load pricing configuration
  const docAICostAmount = parseFloat(await getConfig(CONFIG_KEYS.DOCUMENT_AI_COST_AMOUNT) || '1.50');
  const docAIPageUnit = parseInt(await getConfig(CONFIG_KEYS.DOCUMENT_AI_PAGE_UNIT) || '1000', 10);
  const geminiCostAmount = parseFloat(await getConfig(CONFIG_KEYS.GEMINI_COST_AMOUNT) || '0.35');
  const geminiTokenUnit = parseInt(await getConfig(CONFIG_KEYS.GEMINI_TOKEN_UNIT) || '1000000', 10);

  // Calculate actual costs based on usage and pricing
  const docAICost = (tracking.documentAIPages / docAIPageUnit) * docAICostAmount;
  const geminiTotalTokens = tracking.geminiTokensSent + tracking.geminiTokensReceived;
  const geminiCost = (geminiTotalTokens / geminiTokenUnit) * geminiCostAmount;
  const totalCost = docAICost + geminiCost;

  // Update the tracking record with calculated cost
  await prisma.costTracking.update({
    where: { id: tracking.id },
    data: { estimatedCost: totalCost }
  });

  return {
    month: tracking.month,
    documentAI: {
      used: tracking.documentAIPages,
      limit: tracking.documentAIPagesLimit,
      percentage: Math.round((tracking.documentAIPages / tracking.documentAIPagesLimit) * 100)
    },
    gemini: {
      tokensSent: tracking.geminiTokensSent,
      tokensReceived: tracking.geminiTokensReceived,
      totalTokens: geminiTotalTokens,
      limit: tracking.geminiTokensLimit,
      percentage: Math.round((geminiTotalTokens / tracking.geminiTokensLimit) * 100)
    },
    estimatedCost: totalCost
  };
}
