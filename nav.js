const hamburgerMenu = document.querySelector('.hamburger-menu');
const navLinks = document.querySelector('.nav-links');

hamburgerMenu.addEventListener('click', () => {
  navLinks.classList.toggle('show-nav');
  hamburgerMenu.querySelector('.bar').classList.toggle('animate');
});
