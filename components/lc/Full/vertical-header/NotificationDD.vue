<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useNotificationsStore } from '@/stores/notifications';
import { useRouter } from 'vue-router';

const store = useNotificationsStore();
const router = useRouter();

// Fetch on first open rather than on mount — this dropdown has no polling
// elsewhere in the app to match, and it's a hover/click menu so "open" is
// a natural refresh point.
let loaded = false;
function onOpen(isOpen: boolean) {
  if (isOpen && !loaded) {
    loaded = true;
    store.fetch();
  }
}

function iconFor(event: string) {
  if (event === 'hospital.provisioning_failed') return 'cloud-cross-line-duotone';
  return 'bell-bing-line-duotone';
}
function colorFor(event: string) {
  if (event === 'hospital.provisioning_failed') return 'warning';
  return 'primary';
}

async function onItemClick(item: (typeof store.items)[number]) {
  await store.markRead(item.id);
  const orgId = item.data.organization_id;
  if (typeof orgId === 'string') router.push(`/hospitals/${orgId}`);
}
</script>
<template>
    <!-- ---------------------------------------------- -->
    <!-- notifications DD -->
    <!-- ---------------------------------------------- -->
    <v-menu open-on-hover open-on-click @update:model-value="onOpen">
        <template v-slot:activator="{ props }">
            <v-btn icon class="custom-hover-primary" size="small" rounded="circle" variant="text" color="primary" v-bind="props">
                <Icon icon="solar:bell-bing-line-duotone" height="22"   />
            </v-btn>
        </template>
        <v-sheet rounded="md" width="360" elevation="10">
            <div class="px-6 pt-6 pb-4">
                <div class="d-flex align-center justify-space-between">
                    <h6 class="text-h5">Notifications</h6>
                    <v-chip v-if="store.unread" color="primary" variant="flat" size="small" class="text-white rounded-sm">{{ store.unread }} New</v-chip>
                </div>
            </div>
            <perfect-scrollbar style="height: 350px">
                <v-list class="py-0 theme-list" lines="two">
                    <v-list-item v-if="!store.loading && !store.items.length" class="py-6 px-6 text-center">
                        <span class="text-subtitle-2 textSecondary">No notifications</span>
                    </v-list-item>
                    <v-list-item v-for="item in store.items" :key="item.id" :value="item" color="primary" class="py-3 px-6"
                        :class="{ 'bg-lightprimary': !item.read }" @click="onItemClick(item)">
                        <template v-slot:prepend>
                            <v-avatar size="45" :color="'light' + colorFor(item.data.event)" rounded="circle">
                                <Icon :icon="'solar:' + iconFor(item.data.event)" height="20" :class="'text-' + colorFor(item.data.event)"/>
                            </v-avatar>
                        </template>
                        <div class="d-flex justify-space-between">
                            <p class="text-subtitle-2 font-weight-regular textSecondary mb-0">{{ item.data.message }}</p>
                        </div>
                        <span class="text-caption textSecondary">{{ item.created_at }}</span>
                    </v-list-item>
                </v-list>
            </perfect-scrollbar>
            <div class="py-4 px-6 text-center">
                <v-btn color="primary" variant="flat" size="large" block :disabled="!store.unread" @click="store.markAllRead()">
                    Mark all as read
                </v-btn>
            </div>
        </v-sheet>
    </v-menu>
</template>
