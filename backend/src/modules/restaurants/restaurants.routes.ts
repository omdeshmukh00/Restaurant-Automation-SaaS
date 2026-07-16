// src/modules/restaurants/restaurants.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { roleGuard } from '../../middleware/roleGuard';
import { validate } from '../../middleware/validate';
import { UserRole } from '../../constants/roles';
import {
  updateRestaurantSettingsSchema,
  restaurantSlugParamSchema,
  updateRestaurantProfileSchema,
} from './restaurants.schema';
import {
  getPublicRestaurantController,
  getRestaurantOverviewController,
  getRestaurantSettingsController,
  updateRestaurantSettingsController,
  updateRestaurantProfileController,
  addFloorController,
  removeFloorController,
  addSectionController,
  removeSectionController,
  getFloorsController,
  getSectionsController,
} from './restaurants.controller';

const router = Router();

/*
|--------------------------------------------------------------------------
| PUBLIC
|--------------------------------------------------------------------------
*/

// GET /public/restaurants/:slug
router.get(
  '/public/restaurants/:slug',
  validate({ params: restaurantSlugParamSchema }),
  getPublicRestaurantController,
);

/*
|--------------------------------------------------------------------------
| ADMIN (Restaurant Admin + Super Admin)
|--------------------------------------------------------------------------
*/

const adminRoles = [UserRole.RESTAURANT_ADMIN, UserRole.SUPER_ADMIN];

// GET /admin/restaurant/overview
router.get(
  '/admin/restaurant/overview',
  requireAuth,
  roleGuard(...adminRoles),
  getRestaurantOverviewController,
);

// GET /admin/restaurant/settings
router.get(
  '/admin/restaurant/settings',
  requireAuth,
  roleGuard(...adminRoles),
  getRestaurantSettingsController,
);

// PATCH /admin/restaurant/settings
router.patch(
  '/admin/restaurant/settings',
  requireAuth,
  roleGuard(...adminRoles),
  validate({ body: updateRestaurantSettingsSchema }),
  updateRestaurantSettingsController,
);

// PATCH /admin/restaurant/profile
router.patch(
  '/admin/restaurant/profile',
  requireAuth,
  roleGuard(...adminRoles),
  validate({ body: updateRestaurantProfileSchema }),
  updateRestaurantProfileController,
  );
// Floor management — dedicated create + delete paths backed by MongoDB
router.post(
  '/admin/restaurant/floors',
  requireAuth,
  roleGuard(...adminRoles),
  addFloorController,
);
router.delete(
  '/admin/restaurant/floors/:number',
  requireAuth,
  roleGuard(...adminRoles),
  removeFloorController,
);

// Section management — dedicated create + delete paths backed by MongoDB
router.post(
  '/admin/restaurant/sections',
  requireAuth,
  roleGuard(...adminRoles),
  addSectionController,
);
router.delete(
  '/admin/restaurant/sections/:name',
  requireAuth,
  roleGuard(...adminRoles),
  removeSectionController,
);

// Read floors / sections
router.get(
  '/admin/restaurant/floors',
  requireAuth,
  roleGuard(...adminRoles),
  getFloorsController,
);
router.get(
  '/admin/restaurant/sections',
  requireAuth,
  roleGuard(...adminRoles),
  getSectionsController,
);

export default router;