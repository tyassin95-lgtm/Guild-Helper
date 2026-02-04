/**
 * Role Lock Modal - Client-side functionality
 * Automatically shows modal and blocks page interaction if user has excluded role
 */

(function() {
  'use strict';
  
  /**
   * Initialize the role lock modal
   * Call this function on page load with the hasExcludedRole flag
   */
  window.initRoleLock = function(hasExcludedRole) {
    if (!hasExcludedRole) {
      return; // User doesn't have excluded role, no need to show modal
    }
    
    // Show the modal
    showRoleLockModal();
    
    // Blur the page content
    blurPageContent();
    
    // Prevent all interactions with the page
    blockPageInteraction();
  };
  
  /**
   * Show the role lock modal
   */
  function showRoleLockModal() {
    const modal = document.getElementById('roleLockModal');
    if (modal) {
      modal.classList.add('active');
    }
  }
  
  /**
   * Blur the page content behind the modal
   */
  function blurPageContent() {
    // Get all elements except the modal
    const body = document.body;
    const modal = document.getElementById('roleLockModal');
    
    // Add blur class to all children except the modal
    Array.from(body.children).forEach(child => {
      if (child !== modal && child.id !== 'roleLockModal') {
        child.classList.add('role-lock-blur');
      }
    });
  }
  
  /**
   * Block all page interactions
   */
  function blockPageInteraction() {
    // Prevent scrolling
    document.body.style.overflow = 'hidden';
    
    // Prevent all clicks except on the modal
    document.addEventListener('click', preventInteraction, true);
    document.addEventListener('keydown', preventInteraction, true);
    document.addEventListener('submit', preventInteraction, true);
  }
  
  /**
   * Prevent interaction with page elements
   */
  function preventInteraction(event) {
    const modal = document.getElementById('roleLockModal');
    
    // Allow interactions within the modal
    if (modal && modal.contains(event.target)) {
      return;
    }
    
    // Block all other interactions
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
  
})();
