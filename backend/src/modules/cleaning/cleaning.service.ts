import { Types } from 'mongoose';
import { CleaningStatus, Priority, QueueStatus, RequestStatus, RequestType } from '../../constants/statuses';
import { CleaningTaskModel, type ICleaningTask } from './cleaning.model';
import { StaffRequestModel } from '../staff/staffRequest.model';
import { QueueEntryModel } from '../queue/queue.model';
import { TableModel } from '../tables/tables.model';

type EnsureCleaningTaskInput = {
  restaurantId: string | Types.ObjectId;
  tableId: string | Types.ObjectId;
  sessionId?: string | Types.ObjectId | null;
  priority?: Priority;
};

export async function getQueueWaitingCountForTable(
  restaurantId: string | Types.ObjectId,
  tableId: string | Types.ObjectId,
): Promise<number> {
  const table = await TableModel.findById(tableId);
  const capacity = table?.capacity ?? 2;

  const count = await QueueEntryModel.countDocuments({
    restaurantId,
    status: QueueStatus.WAITING,
    guests: { $gte: capacity - 1 },
  });

  return count;
}

async function resolvePriority(input: EnsureCleaningTaskInput): Promise<{ priority: Priority; queueWaitingCount: number }> {
  const queueWaitingCount = await getQueueWaitingCountForTable(input.restaurantId, input.tableId);

  if (input.priority) {
    return { priority: input.priority, queueWaitingCount };
  }

  let hasCleaningRequest = false;
  if (input.sessionId) {
    const found = await StaffRequestModel.exists({
      restaurantId: input.restaurantId,
      sessionId: input.sessionId,
      tableId: input.tableId,
      type: RequestType.CLEANING,
      status: { $in: [RequestStatus.PENDING, RequestStatus.ACCEPTED] },
    });
    hasCleaningRequest = Boolean(found);
  }

  let priority = Priority.NORMAL;
  if (queueWaitingCount >= 5) {
    priority = Priority.CRITICAL;
  } else if (queueWaitingCount >= 1 || hasCleaningRequest) {
    priority = Priority.HIGH;
  }

  return { priority, queueWaitingCount };
}

export async function ensureCleaningTaskForTable(input: EnsureCleaningTaskInput): Promise<ICleaningTask> {
  const { priority, queueWaitingCount } = await resolvePriority(input);
  const existingTask = await CleaningTaskModel.findOne({
    restaurantId: input.restaurantId,
    tableId: input.tableId,
  }).sort({ createdAt: -1 });

  if (existingTask) {
    if (existingTask.status === CleaningStatus.COMPLETED) {
      return existingTask;
    }

    if (existingTask.status !== CleaningStatus.VERIFIED) {
      existingTask.priority = priority;
      existingTask.queueWaitingCount = queueWaitingCount;
      existingTask.status = CleaningStatus.PENDING;
      existingTask.startedBy = null;
      existingTask.completedBy = null;
      existingTask.verifiedBy = null;
      existingTask.startedAt = null;
      existingTask.completedAt = null;
      existingTask.verifiedAt = null;
      await existingTask.save();
      return existingTask;
    }
  }

  return CleaningTaskModel.create({
    restaurantId: input.restaurantId,
    tableId: input.tableId,
    priority,
    queueWaitingCount,
    status: CleaningStatus.PENDING,
    startedBy: null,
    completedBy: null,
    verifiedBy: null,
    startedAt: null,
    completedAt: null,
    verifiedAt: null,
  });
}
